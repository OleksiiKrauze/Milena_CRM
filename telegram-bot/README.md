# Telegram Бот для MilenaCRM

Telegram бот для прийому заявок про зниклих осіб з автоматичною інтеграцією в CRM систему.

## Функціональність

Бот приймає заявки в наступному форматі:

1. Користувач відправляє `/start`
2. Отримує інструкцію з 6 запитаннями
3. Відправляє всю інформацію одним повідомленням
4. Бот створює заявку в CRM через API (з автоматичним OpenAI autofill)
5. Просить надіслати фото або натиснути "Зараз немає"
6. Якщо є фото - завантажує їх до заявки (до 10 фото)
7. Відправляє підтвердження

## Технології

- **Python 3.12**
- **aiogram 3.15** - сучасна бібліотека для Telegram Bot API
- **aiohttp** - асинхронні HTTP запити
- **Docker** - контейнеризація

## Структура проекту

```
telegram-bot/
├── bot.py              # Головний код бота
├── requirements.txt    # Python залежності
├── Dockerfile          # Docker образ
├── .dockerignore       # Ігноровані файли для Docker
└── README.md          # Ця документація
```

## Змінні середовища

Бот використовує наступні змінні:

| Змінна | Опис | Обов'язкова |
|--------|------|-------------|
| `TELEGRAM_BOT_TOKEN` | API токен від BotFather | Так |
| `CRM_API_URL` | URL CRM API (за замовчуванням: http://backend:8000) | Ні |
| `CRM_API_KEY` | API ключ для доступу до CRM (якщо налаштовано) | Ні |

## Локальний запуск

### 1. Встановлення залежностей

```bash
cd telegram-bot
pip install -r requirements.txt
```

### 2. Налаштування змінних

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
export CRM_API_URL="http://localhost:8000"
export CRM_API_KEY="your_api_key"  # Опціонально
```

### 3. Запуск бота

```bash
python bot.py
```

## Production Deployment

### 1. Отримання токену від BotFather

1. Відкрийте Telegram і знайдіть [@BotFather](https://t.me/botfather)
2. Відправте команду `/newbot` або `/token` якщо бот вже існує
3. Скопіюйте токен (формат: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Додайте токен до `.env.production`

На сервері відредагуйте файл:

```bash
sudo nano ~/MilenaCRM/.env.production
```

Додайте:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Опціонально: якщо не налаштовано раніше
PUBLIC_API_KEY=your_secret_api_key
```

### 3. Запуск на сервері

```bash
cd ~/MilenaCRM

# Зібрати образ бота
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build telegram-bot

# Запустити бота
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d telegram-bot

# Перевірити статус
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps

# Переглянути логи
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f telegram-bot
```

### 4. Перевірка роботи

1. Знайдіть свого бота в Telegram за username
2. Відправте `/start`
3. Відправте тестову заявку
4. Перевірте чи створилась заявка в CRM

## Моніторинг та діагностика

### Перегляд логів

```bash
# Реальний час
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f telegram-bot

# Останні 100 рядків
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 telegram-bot
```

### Перезапуск бота

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart telegram-bot
```

### Оновлення коду бота

```bash
cd ~/MilenaCRM
git pull origin main

# Перезібрати та перезапустити
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build telegram-bot
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d telegram-bot
```

## Приклади логів

### Успішна робота

```
INFO - Telegram bot started!
INFO - CRM API URL: http://backend:8000
INFO - API Key configured: Yes
INFO - User 123456789 started new case submission
INFO - Case 158 created for user 123456789
INFO - Photo uploaded to case 158, total: 1
INFO - User 123456789 submitted case 158 without photos
```

### Помилки

```
ERROR - Network error: Cannot connect to host backend:8000
ERROR - Error creating case: Помилка валідації даних
ERROR - Unexpected error: ...
```

## Типові проблеми та рішення

### Бот не відповідає

1. Перевірте що контейнер запущений:
   ```bash
   sudo docker ps | grep telegram-bot
   ```

2. Перевірте логи на помилки:
   ```bash
   sudo docker logs crm_telegram_bot
   ```

3. Перевірте що токен правильний:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec telegram-bot env | grep TELEGRAM
   ```

### Помилка підключення до CRM

1. Перевірте що backend працює:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps backend
   ```

2. Перевірте що бот в тій же мережі:
   ```bash
   sudo docker network inspect milenacrm_crm_network
   ```

3. Спробуйте підключитись до backend з контейнера бота:
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec telegram-bot curl http://backend:8000/health
   ```

### Фото не завантажуються

1. Перевірте логи бота
2. Перевірте що endpoint `/public/telegram/case/{id}/photos` працює
3. Перевірте ліміти розміру файлів

## Команди бота

- `/start` - Почати нову заявку або перезапустити форму

## Обмеження

- Максимум 10 фото на заявку
- Підтримувані формати фото: JPEG, PNG (Telegram автоматично конвертує)
- Розмір фото обмежений Telegram (до 20MB для фото, але бот завантажує compressed версію)

## Підтримка

При виникненні проблем:
1. Перевірте логи бота та backend
2. Перевірте що всі змінні середовища налаштовані
3. Перевірте що endpoints `/public/telegram/case` працюють
4. Перевірте що OPENAI_API_KEY налаштовано для autofill

## Безпека

- Токен бота НІКОЛИ не комітиться в Git
- Токен зберігається тільки в `.env.production` на сервері
- API ключ (якщо використовується) також в `.env.production`
- Rate limiting на CRM захищає від зловживань
