"""
Скрипт миграции данных с форума phpBB в CRM
"""
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import json
import time
import re
import requests
import io
from typing import Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urlparse

class ForumMigrator:
    def __init__(self, forum_url: str = "https://milena.in.ua/forum", api_url: str = "http://localhost:8000"):
        self.forum_url = forum_url
        self.api_url = api_url
        self.driver = None
        self.api_token = None

    def setup_driver(self):
        """Настройка Chrome WebDriver"""
        print("🔧 Настройка браузера...")
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        service = Service('/usr/bin/chromedriver')
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.driver.implicitly_wait(10)
        print("✓ Браузер настроен")

    def login_forum(self, username: str, password: str) -> bool:
        """Авторизация на форуме"""
        print(f"🔐 Авторизация на форуме: {username}")
        try:
            login_url = f"{self.forum_url}/ucp.php?mode=login"
            self.driver.get(login_url)

            wait = WebDriverWait(self.driver, 10)
            username_field = wait.until(EC.presence_of_element_located((By.NAME, "username")))
            username_field.send_keys(username)

            password_field = self.driver.find_element(By.NAME, "password")
            password_field.send_keys(password)

            time.sleep(0.5)
            login_button = self.driver.find_element(By.NAME, "login")
            login_button.click()
            time.sleep(2)

            page_source = self.driver.page_source
            if 'mode=logout' in page_source:
                print("✅ Авторизация на форуме успешна")
                return True
            return False
        except Exception as e:
            print(f"❌ Ошибка авторизации на форуме: {e}")
            return False

    def login_api(self, email: str, password: str) -> bool:
        """Авторизация в CRM API"""
        print(f"🔐 Авторизация в CRM API: {email}")
        try:
            response = requests.post(
                f"{self.api_url}/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                self.api_token = response.json()["access_token"]
                print("✅ Авторизация в API успешна")
                return True
            else:
                print(f"❌ Ошибка API авторизации: {response.status_code}")
                print(f"   Ответ: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Ошибка подключения к API: {e}")
            return False

    def get_topics_from_subforum(self, subforum_id: int, max_topics: int = 10) -> List[Dict]:
        """Получить темы из подфорума (с обработкой нескольких страниц)"""
        print(f"\n📋 Получение до {max_topics} тем из подфорума (ID: {subforum_id})")
        print(f"   ℹ️  Обрабатываются все страницы подфорума до достижения лимита")

        topics = []
        page = 0
        topics_per_page = 25  # Стандарт phpBB

        while len(topics) < max_topics:
            start = page * topics_per_page
            url = f"{self.forum_url}/viewforum.php?f={subforum_id}&start={start}"

            print(f"\n   📄 Страница {page + 1} (start={start})... ", end="", flush=True)
            self.driver.get(url)
            time.sleep(1)

            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            topic_links = soup.find_all('a', class_='topictitle')

            if not topic_links:
                print("❌ Нет тем на странице")
                break

            print(f"✓ Найдено {len(topic_links)} тем")

            # Собираем темы со страницы
            page_topics_added = 0
            for link in topic_links:
                if len(topics) >= max_topics:
                    print(f"   ⚠️  Достигнут лимит тем ({max_topics}), останавливаем сбор")
                    break

                topic_data = {
                    'title': link.get_text(strip=True),
                    'url': self.forum_url + '/' + link['href'] if link['href'].startswith('./') else link['href'],
                    'topic_id': link['href'].split('t=')[1].split('&')[0] if 't=' in link['href'] else None
                }
                topics.append(topic_data)
                page_topics_added += 1

            print(f"      → Добавлено: {page_topics_added}, всего собрано: {len(topics)}/{max_topics}")

            # Достигли лимита - выходим
            if len(topics) >= max_topics:
                break

            # Проверяем наличие следующей страницы (несколько способов)
            next_link = soup.find('a', class_='next')
            if not next_link:
                # Попробуем найти ссылку "Вперед" или "Наступна"
                next_link = soup.find('a', string=lambda s: s and ('Вперед' in s or 'Наступна' in s or 'Next' in s))

            if not next_link:
                # Попробуем найти ссылку с параметром start больше текущего
                all_links = soup.find_all('a', href=lambda href: href and f'f={subforum_id}' in href and 'start=' in href)
                for link in all_links:
                    href = link['href']
                    if 'start=' in href:
                        link_start = int(href.split('start=')[1].split('&')[0])
                        if link_start > start:
                            next_link = link
                            break

            if not next_link:
                print(f"   ℹ️  Это последняя страница подфорума (кнопка 'Далее' не найдена)")
                break

            print(f"   → Найдена следующая страница")
            page += 1
            time.sleep(0.5)  # Задержка между запросами страниц

        print(f"\n✅ Всего собрано тем: {len(topics)} (обработано страниц: {page + 1})")
        return topics

    def parse_topic_title(self, title: str) -> Tuple[str, str, str]:
        """
        Парсит название темы для определения ФИО и статуса
        Returns: (full_name, search_status, search_result)
        """
        title_lower = title.lower()

        # Определяем статус и результат
        if 'шукаємо' in title_lower or 'ищем' in title_lower or 'шукаю' in title_lower:
            search_status = 'active'
            search_result = None
        elif 'найден' in title_lower or 'найдена' in title_lower:
            search_status = 'completed'
            search_result = 'alive'
        elif 'обнаружен' in title_lower or 'виявлено' in title_lower:
            search_status = 'completed'
            search_result = 'dead'
        elif 'удален' in title_lower or 'видалено' in title_lower:
            search_status = 'cancelled'
            search_result = None
        else:
            search_status = 'active'
            search_result = None

        # Извлекаем ФИО - всё после ключевого слова
        name_patterns = [
            r'шукаємо\s+(.+)',
            r'ищем\s+(.+)',
            r'шукаю\s+(.+)',
            r'найден\s+(.+)',
            r'найдена\s+(.+)',
            r'обнаружен\s+(.+)',
            r'виявлено\s+(.+)',
            r'удален\.\s+(.+)',
            r'видалено\.\s+(.+)',
        ]

        full_name = title  # По умолчанию всё название
        for pattern in name_patterns:
            match = re.search(pattern, title_lower)
            if match:
                # Берем соответствующую часть из оригинального title (с сохранением регистра)
                start_pos = match.start(1)
                full_name = title[start_pos:].strip()
                break

        return full_name, search_status, search_result

    def download_and_upload_images(self, image_urls: List[str]) -> List[str]:
        """
        Download images from forum and upload to CRM
        Returns: List of uploaded image URLs from CRM (e.g., ["/uploads/uuid_filename.jpg"])
        """
        if not image_urls:
            return []

        uploaded_urls = []
        headers = {'Authorization': f'Bearer {self.api_token}'}

        # Get cookies from Selenium driver for authenticated requests
        selenium_cookies = {}
        if self.driver:
            for cookie in self.driver.get_cookies():
                selenium_cookies[cookie['name']] = cookie['value']

        for idx, image_url in enumerate(image_urls, 1):
            try:
                # Download image from forum
                print(f"      📥 Скачивание изображения {idx}/{len(image_urls)}: {image_url}")

                # Use cookies from Selenium for authenticated download
                download_response = requests.get(
                    image_url,
                    cookies=selenium_cookies,
                    timeout=30,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )

                if download_response.status_code != 200:
                    print(f"      ⚠️  Не удалось скачать изображение: HTTP {download_response.status_code}")
                    continue

                # Determine file extension from Content-Type
                content_type = download_response.headers.get('content-type', 'image/jpeg').lower()
                ext_mapping = {
                    'image/jpeg': '.jpg',
                    'image/jpg': '.jpg',
                    'image/png': '.png',
                    'image/gif': '.gif',
                    'image/webp': '.webp',
                }
                file_extension = ext_mapping.get(content_type, '.jpg')

                # Generate filename
                filename = f"forum_image_{idx}{file_extension}"

                # Upload to CRM
                files = {
                    'files': (filename, io.BytesIO(download_response.content), content_type)
                }

                upload_response = requests.post(
                    f"{self.api_url}/upload/images",
                    files=files,
                    headers=headers,
                    timeout=30
                )

                if upload_response.status_code == 200:
                    uploaded_paths = upload_response.json()
                    if uploaded_paths:
                        uploaded_urls.append(uploaded_paths[0])
                        print(f"      ✅ Изображение загружено: {uploaded_paths[0]}")
                else:
                    print(f"      ⚠️  Не удалось загрузить в CRM: HTTP {upload_response.status_code}")
                    print(f"          {upload_response.text}")

            except Exception as e:
                print(f"      ❌ Ошибка обработки изображения {image_url}: {e}")
                continue

        if uploaded_urls:
            print(f"      ✅ Успешно загружено {len(uploaded_urls)}/{len(image_urls)} изображений")
        else:
            print(f"      ⚠️  Не удалось загрузить ни одного изображения из {len(image_urls)}")

        return uploaded_urls

    def parse_post_date(self, date_str: str, time_included: bool = True) -> str:
        """
        Парсит дату поста в ISO формат
        Пример: "21 мар 2023, 11:13" или "03 сен 2023, 14:05"

        Args:
            date_str: строка даты
            time_included: если False, возвращает только дату без времени
        """
        # Словарь русских месяцев
        months_ru = {
            'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'июн': 6,
            'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12
        }

        # Украинские месяцы
        months_uk = {
            'січ': 1, 'лют': 2, 'бер': 3, 'кві': 4, 'тра': 5, 'чер': 6,
            'лип': 7, 'сер': 8, 'вер': 9, 'жов': 10, 'лис': 11, 'гру': 12
        }

        months = {**months_ru, **months_uk}

        try:
            # Парсим формат "21 мар 2023, 11:13"
            parts = date_str.split(',')
            if len(parts) >= 2:
                date_part = parts[0].strip()
                time_part = parts[1].strip()

                date_elements = date_part.split()
                if len(date_elements) >= 3:
                    day = int(date_elements[0])
                    month_str = date_elements[1][:3].lower()
                    year = int(date_elements[2])

                    month = months.get(month_str, 1)

                    if time_included:
                        time_elements = time_part.split(':')
                        hour = int(time_elements[0]) if len(time_elements) > 0 else 0
                        minute = int(time_elements[1]) if len(time_elements) > 1 else 0
                        dt = datetime(year, month, day, hour, minute)
                        return dt.isoformat()
                    else:
                        # Возвращаем только дату без времени
                        dt = datetime(year, month, day)
                        return dt.date().isoformat()
        except Exception as e:
            print(f"⚠️  Ошибка парсинга даты '{date_str}': {e}")

        # Если не удалось распарсить, возвращаем текущую дату
        if time_included:
            return datetime.now().isoformat()
        else:
            return datetime.now().date().isoformat()

    def get_topic_details(self, topic_url: str) -> Dict:
        """Получить детальную информацию о теме"""
        print(f"\n🔍 Анализ темы: {topic_url}")

        self.driver.get(topic_url)
        time.sleep(1)

        soup = BeautifulSoup(self.driver.page_source, 'html.parser')

        # Заголовок
        title_elem = soup.find('h2', class_='topic-title')
        if not title_elem:
            title_elem = soup.find('h2')

        topic_data = {
            'title': title_elem.get_text(strip=True) if title_elem else 'Unknown',
            'url': topic_url,
            'posts': []
        }

        # Посты
        posts = soup.find_all('div', class_='post')
        print(f"   Найдено постов: {len(posts)}")

        for post in posts:
            post_data = self._parse_post(post)
            if post_data:
                topic_data['posts'].append(post_data)

        return topic_data

    def _parse_post(self, post) -> Optional[Dict]:
        """Парсинг одного поста"""
        try:
            post_data = {}

            # Автор и дата
            author = post.find('p', class_='author')
            if author:
                author_link = author.find('a', class_='username')
                if author_link:
                    post_data['author'] = author_link.get_text(strip=True)

                post_date = author.find('time')
                if post_date:
                    post_data['date'] = post_date.get_text(strip=True)

            # Содержимое
            content = post.find('div', class_='content')
            if content:
                # Сохраняем переводы строк для правильной интерпретации ChatGPT
                post_data['content'] = content.get_text(separator='\n', strip=True)

                # Изображения
                images = content.find_all('img')
                if images:
                    post_data['images'] = []
                    for img in images:
                        src = img.get('src', '')
                        # Делаем полный URL
                        if src.startswith('./'):
                            src = self.forum_url + '/' + src[2:]
                        elif not src.startswith('http'):
                            src = self.forum_url + '/' + src
                        post_data['images'].append(src)

            return post_data
        except Exception as e:
            print(f"⚠️  Ошибка парсинга поста: {e}")
            return None

    def create_case_from_topic(self, topic: Dict) -> Optional[int]:
        """Создать заявку из темы форума"""
        print(f"\n📝 Создание заявки: {topic['title']}")

        # Парсим название
        full_name, search_status, search_result = self.parse_topic_title(topic['title'])
        print(f"   ФИО: {full_name}")
        print(f"   Статус поиска: {search_status}, Результат: {search_result}")

        # Разделяем ФИО на части (простой подход - берем первые 3 слова)
        name_parts = full_name.split()
        last_name = name_parts[0] if len(name_parts) > 0 else 'Unknown'
        first_name = name_parts[1] if len(name_parts) > 1 else 'Unknown'
        middle_name = name_parts[2] if len(name_parts) > 2 else None

        # Первый пост = первинна информація
        first_post = topic['posts'][0] if topic['posts'] else None
        initial_info = first_post['content'] if first_post else ''

        # Дата создания = дата первого поста
        created_at = None
        if first_post and 'date' in first_post:
            created_at = self.parse_post_date(first_post['date'])

        # Фото зниклого из первого поста
        missing_photos = []
        if first_post and 'images' in first_post:
            print(f"   📷 Загрузка {len(first_post['images'])} изображений...")
            missing_photos = self.download_and_upload_images(first_post['images'])
            if missing_photos:
                print(f"   ✅ Загружено {len(missing_photos)} изображений")

        try:
            headers = {'Authorization': f'Bearer {self.api_token}'}

            # Сначала вызываем автозаполнение, чтобы извлечь данные из initial_info
            extracted_fields = {}
            if initial_info:
                print(f"   🤖 Автозаполнение полей из первичной информации...")
                autofill_response = requests.post(
                    f"{self.api_url}/cases/autofill",
                    json={"initial_info": initial_info},
                    headers=headers,
                    timeout=30  # Ждем ответа ChatGPT до 30 секунд
                )

                if autofill_response.status_code == 200:
                    autofill_data = autofill_response.json()
                    extracted_fields = autofill_data.get('fields', {})

                    if extracted_fields:
                        print(f"   ✅ Автозаполнение: извлечено {len(extracted_fields)} полей")
                    else:
                        print(f"   ℹ️  Автозаполнение не вернуло полей")
                else:
                    print(f"   ⚠️  Автозаполнение не выполнено: {autofill_response.status_code}")
                    if autofill_response.status_code == 500:
                        print(f"   ℹ️  Возможно, не настроен OPENAI_API_KEY")

            # Создаем базовые данные заявки
            case_data = {
                'created_at': created_at,  # Устанавливаем дату из форума
                'missing_last_name': last_name,
                'missing_first_name': first_name,
                'initial_info': initial_info,
                'missing_photos': missing_photos,  # Добавляем загруженные фото
                'police_report_filed': True,  # Для всех импортированных заявок - заява до поліції подана
            }

            # Добавляем тег с topic_id для защиты от дубликатов
            if 'topic_id' in topic and topic['topic_id']:
                case_data['tags'] = [f"forum_topic_{topic['topic_id']}"]

            # Fallback для обязательных полей заявителя
            case_data['applicant_last_name'] = extracted_fields.get('applicant_last_name') or 'Форум'
            case_data['applicant_first_name'] = extracted_fields.get('applicant_first_name') or 'Міграція'

            if middle_name:
                case_data['missing_middle_name'] = middle_name

            # Определяем decision_type на основе результата
            if search_result == 'alive':
                case_data['decision_type'] = 'Пошук'
            elif search_result == 'dead':
                case_data['decision_type'] = 'Пошук'
            elif search_status == 'cancelled':
                case_data['decision_type'] = 'Відмова'
            else:
                case_data['decision_type'] = 'Пошук'

            # Объединяем с остальными автозаполненными полями
            # Исключаем: applicant поля (обработаны выше с fallback) и decision_type (установлен жестко)
            excluded_fields = ['applicant_last_name', 'applicant_first_name', 'decision_type']
            for key, value in extracted_fields.items():
                if key not in excluded_fields and value is not None:
                    case_data[key] = value

            # DEBUG: Проверяем наличие basis
            if 'basis' in case_data:
                print(f"   ✓ basis встановлено: {case_data['basis']}")
            else:
                print(f"   ⚠️  basis відсутнє в case_data")

            # Создаем заявку с полными данными за один раз
            response = requests.post(
                f"{self.api_url}/cases",
                json=case_data,
                headers=headers
            )

            if response.status_code == 201:
                case = response.json()
                case_id = case['id']
                print(f"   ✅ Заявка создана: ID {case_id}")
                return case_id
            else:
                print(f"   ❌ Ошибка создания заявки: {response.status_code}")
                print(f"      {response.text}")
                return None

        except Exception as e:
            print(f"   ❌ Исключение при создании заявки: {e}")
            return None

    def create_search_for_case(self, case_id: int, topic: Dict) -> Optional[int]:
        """Создать пошук для заявки (если постов > 1)"""
        if len(topic['posts']) <= 1:
            print("   ℹ️  Только один пост - пошук не создается")
            return None

        print(f"\n🔎 Создание пошука для заявки {case_id}")

        # Определяем статус и результат
        _, search_status, search_result = self.parse_topic_title(topic['title'])

        # Дата начала = дата первого поста (без времени для валидации API)
        first_post = topic['posts'][0]
        start_date = self.parse_post_date(first_post['date'], time_included=False) if 'date' in first_post else None
        created_at = self.parse_post_date(first_post['date']) if 'date' in first_post else None

        search_data = {
            'created_at': created_at,  # Устанавливаем дату создания из форума
            'case_id': case_id,
            'status': search_status,
            'start_date': start_date,
        }

        if search_result:
            search_data['result'] = search_result

        # Дата завершения = дата последнего поста (если поиск завершен)
        if search_status == 'completed' and len(topic['posts']) > 1:
            last_post = topic['posts'][-1]
            if 'date' in last_post:
                search_data['end_date'] = self.parse_post_date(last_post['date'], time_included=False)

        try:
            headers = {'Authorization': f'Bearer {self.api_token}'}
            response = requests.post(
                f"{self.api_url}/searches",
                json=search_data,
                headers=headers
            )

            if response.status_code == 201:
                search = response.json()
                search_id = search['id']
                print(f"   ✅ Пошук создан: ID {search_id}")
                return search_id
            else:
                print(f"   ❌ Ошибка создания пошука: {response.status_code}")
                print(f"      {response.text}")
                return None

        except Exception as e:
            print(f"   ❌ Исключение при создании пошука: {e}")
            return None

    def create_events_from_posts(self, search_id: int, posts: List[Dict]):
        """Создать события из постов (начиная со 2-го)"""
        if len(posts) <= 1:
            return

        print(f"\n📅 Создание событий для пошука {search_id}")

        # Пропускаем первый пост (он уже в initial_info)
        for i, post in enumerate(posts[1:], 2):
            print(f"   Пост {i}/{len(posts)}... ", end="", flush=True)

            description = post.get('content', '')
            event_datetime = self.parse_post_date(post['date']) if 'date' in post else datetime.now().isoformat()

            # Загружаем изображения если есть
            media_files = []
            if 'images' in post and post['images']:
                print(f"\n      📷 Загрузка {len(post['images'])} изображений для поста...")
                media_files = self.download_and_upload_images(post['images'])
                print(f"   Пост {i}/{len(posts)} (с {len(media_files)} фото)... ", end="", flush=True)

            event_data = {
                'search_id': search_id,
                'event_datetime': event_datetime,
                'event_type': 'update',
                'description': description,
                'media_files': media_files,
            }

            try:
                headers = {'Authorization': f'Bearer {self.api_token}'}
                response = requests.post(
                    f"{self.api_url}/events",
                    json=event_data,
                    headers=headers
                )

                if response.status_code == 201:
                    print("✓")
                else:
                    print(f"✗ ({response.status_code})")

            except Exception as e:
                print(f"✗ ({e})")

        print(f"   ✅ События созданы")

    def check_topic_exists(self, topic_id: str) -> bool:
        """Проверить, была ли тема уже импортирована"""
        try:
            headers = {'Authorization': f'Bearer {self.api_token}'}
            # Ищем заявки с тегом forum_topic_{topic_id}
            response = requests.get(
                f"{self.api_url}/cases",
                headers=headers
            )

            if response.status_code == 200:
                cases = response.json().get('cases', [])
                for case in cases:
                    if f"forum_topic_{topic_id}" in case.get('tags', []):
                        return True
            return False
        except Exception as e:
            print(f"   ⚠️  Ошибка проверки дубликата: {e}")
            return False

    def migrate_topic(self, topic_url: str, topic_id: str = None) -> bool:
        """Мигрировать одну тему"""
        try:
            # Извлекаем topic_id если не передан
            if not topic_id and 't=' in topic_url:
                topic_id = topic_url.split('t=')[1].split('&')[0]

            # Проверяем, не импортирована ли уже эта тема
            if topic_id:
                if self.check_topic_exists(topic_id):
                    print(f"   ⏭️  Тема уже импортирована (topic_id: {topic_id}), пропускаем")
                    return True  # Возвращаем True чтобы не считать это ошибкой

            # Получаем детали темы
            topic = self.get_topic_details(topic_url)

            if not topic['posts']:
                print("   ⚠️  Нет постов - пропускаем")
                return False

            # Добавляем topic_id в тему для маркировки
            topic['topic_id'] = topic_id

            # Создаем заявку
            case_id = self.create_case_from_topic(topic)
            if not case_id:
                return False

            # Создаем пошук (если постов > 1)
            search_id = self.create_search_for_case(case_id, topic)

            # Создаем події из постов
            if search_id:
                self.create_events_from_posts(search_id, topic['posts'])

            print(f"✅ Тема успешно мигрирована: Case #{case_id}")
            return True

        except Exception as e:
            print(f"❌ Ошибка миграции темы: {e}")
            import traceback
            traceback.print_exc()
            return False

    def delete_all_cases(self) -> bool:
        """Удалить все заявки из CRM"""
        print("\n🗑️  УДАЛЕНИЕ ВСЕХ ЗАЯВОК")
        print("=" * 80)

        try:
            headers = {'Authorization': f'Bearer {self.api_token}'}

            # Получаем все заявки с пагинацией (максимум 100 за раз)
            skip = 0
            total_deleted = 0

            while True:
                response = requests.get(
                    f"{self.api_url}/cases?limit=100&skip={skip}",
                    headers=headers
                )

                if response.status_code != 200:
                    print(f"❌ Не удалось получить список заявок: {response.status_code}")
                    print(f"   Ответ: {response.text}")
                    return False

                data = response.json()
                cases = data.get('cases', [])
                total = data.get('total', 0)

                if not cases:
                    break

                if skip == 0:
                    print(f"Найдено заявок: {total}")

                for case in cases:
                    try:
                        delete_response = requests.delete(
                            f"{self.api_url}/cases/{case['id']}",
                            headers=headers
                        )
                        if delete_response.status_code == 204:
                            total_deleted += 1
                            print(f"\r🗑️  Удалено {total_deleted}/{total} заявок... ", end="", flush=True)
                    except Exception as e:
                        print(f"\n⚠️  Ошибка удаления заявки {case['id']}: {e}")

                skip += len(cases)

            if total_deleted == 0:
                print("ℹ️  Заявок нет, нечего удалять")
            else:
                print(f"\n✅ Удалено {total_deleted} заявок")

            return True

        except Exception as e:
            print(f"\n❌ Ошибка при удалении заявок: {e}")
            return False

    def migrate_forum(self, forum_username: str, forum_password: str,
                     api_email: str, api_password: str,
                     subforum_id: int = 150, max_topics: int = 10,
                     delete_existing: bool = False):
        """Основной процесс миграции"""
        print("=" * 80)
        print("🚀 МИГРАЦИЯ ФОРУМА В CRM")
        print("=" * 80)

        try:
            # Настройка браузера
            self.setup_driver()

            # Авторизация на форуме
            if not self.login_forum(forum_username, forum_password):
                print("❌ Не удалось авторизоваться на форуме")
                return

            # Авторизация в API
            if not self.login_api(api_email, api_password):
                print("❌ Не удалось авторизоваться в API")
                return

            # Удаление существующих заявок если требуется
            if delete_existing:
                if not self.delete_all_cases():
                    print("⚠️  Не удалось удалить существующие заявки, продолжаем...")
                print()

            # Получаем темы
            topics = self.get_topics_from_subforum(subforum_id, max_topics)

            if not topics:
                print("❌ Темы не найдены")
                return

            # Мигрируем каждую тему
            print("\n" + "=" * 80)
            print(f"📦 МИГРАЦИЯ {len(topics)} ТЕМ")
            print("=" * 80)

            success_count = 0
            for i, topic in enumerate(topics, 1):
                print(f"\n--- Тема {i}/{len(topics)} ---")
                print(f"Название: {topic['title']}")
                if topic.get('topic_id'):
                    print(f"ID темы: {topic['topic_id']}")

                if self.migrate_topic(topic['url'], topic.get('topic_id')):
                    success_count += 1

                time.sleep(1)  # Задержка между темами

            # Итоги
            print("\n" + "=" * 80)
            print("📊 ИТОГИ МИГРАЦИИ")
            print("=" * 80)
            print(f"✅ Успешно мигрировано: {success_count}/{len(topics)}")
            print(f"❌ Ошибок: {len(topics) - success_count}")

        except Exception as e:
            print(f"\n❌ Критическая ошибка: {e}")
            import traceback
            traceback.print_exc()

        finally:
            if self.driver:
                print("\n🔚 Закрытие браузера...")
                self.driver.quit()


def main():
    """Главная функция"""
    print("\n🚀 МИГРАЦИЯ ФОРУМА ПСО 'Милена' → CRM")
    print("=" * 80)

    # Учетные данные форума
    forum_username = "ASD"
    forum_password = "13152GHJkju"

    # Учетные данные API
    api_email = "admin@example.com"
    api_password = "admin123"

    # Подфорум "Архів 2025" (ID: 150)
    subforum_id = 150
    max_topics = 10

    print(f"\n📁 Подфорум: ID {subforum_id}")
    print(f"📋 Количество тем для миграции: {max_topics}")
    print(f"🗑️  Удаление существующих заявок: ДА")

    # Запускаем миграцию
    migrator = ForumMigrator()
    migrator.migrate_forum(
        forum_username, forum_password,
        api_email, api_password,
        subforum_id, max_topics,
        delete_existing=True  # Удаляем все существующие заявки перед импортом
    )


if __name__ == "__main__":
    main()
