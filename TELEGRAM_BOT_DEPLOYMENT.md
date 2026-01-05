# Швидкий запуск Telegram бота на Production

## Передумови

- У вас є токен від [@BotFather](https://t.me/botfather)
- CRM вже працює на сервері
- У вас є SSH доступ до сервера

## Крок 1: Отримання токену бота (якщо ще не отримали)

1. Відкрийте Telegram
2. Знайдіть [@BotFather](https://t.me/botfather)
3. **Якщо бот вже існує:**
   - Відправте `/mybots`
   - Виберіть вашого бота
   - Натисніть "API Token"
   - Скопіюйте токен
4. **Якщо потрібен новий бот:**
   - Відправте `/newbot`
   - Вкажіть назву бота (наприклад: "Milena Missing Persons")
   - Вкажіть username бота (має закінчуватись на `bot`, наприклад: `milena_missing_bot`)
   - Скопіюйте токен

Токен виглядає так: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

## Крок 2: Налаштування на сервері

### 2.1. Підключитися до сервера

```bash
ssh ubuntu@your-server-ip
cd ~/MilenaCRM
```

### 2.2. Оновити код з Git

```bash
git pull origin main
```

### 2.3. Додати токен до .env.production

```bash
sudo nano .env.production
```

Додайте в кінець файлу:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=ВАШ_ТОКЕН_ВІД_BOTFATHER
```

**ВАЖЛИВО:** Замініть `ВАШ_ТОКЕН_ВІД_BOTFATHER` на реальний токен!

Збережіть файл: `Ctrl+O`, `Enter`, `Ctrl+X`

### 2.4. Перевірити що PUBLIC_API_KEY налаштовано (опціонально)

Якщо ви хочете додаткову безпеку, переконайтесь що в `.env.production` є:

```bash
PUBLIC_API_KEY=ваш_секретний_ключ
```

Якщо немає - додайте його (будь-який випадковий рядок).

## Крок 3: Запуск бота

### 3.1. Зібрати та запустити

```bash
# Зібрати образ бота
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build telegram-bot

# Запустити всі сервіси (включаючи бота)
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 3.2. Перевірити що бот запущений

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps
```

Ви повинні побачити `crm_telegram_bot` зі статусом "Up".

### 3.3. Переглянути логи бота

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f telegram-bot
```

Ви повинні побачити:
```
INFO - Telegram bot started!
INFO - CRM API URL: http://backend:8000
INFO - API Key configured: Yes
```

Натисніть `Ctrl+C` щоб вийти з перегляду логів.

## Крок 4: Тестування

1. Відкрийте Telegram
2. Знайдіть вашого бота за username (наприклад: `@milena_missing_bot`)
3. Натисніть "Start" або відправте `/start`
4. Ви повинні побачити інструкцію:

```
Якщо Ви припустилися помилки при заповненні форми, або вказали не всі дані - перезапустіть форму знову, відправивши повідомлення /start

Доброго дня, надайте відповідь на наступні запитання одним повідомленням:

1. Заявник (ПІБ) та ким він є зниклій людині?
2. Контакти заявника: телефон для зв'язку?
3. ПІБ та дата народження зниклої людини?
4. Область та населений пункт зникнення людини?
5. Дата та обставини зникнення?
6. Чи була подана заява до поліції?
```

5. Відправте тестову заявку:

```
1. Іванов Іван Іванович, батько
2. +380501234567
3. Іванов Петро Іванович, 15.05.2000
4. Львівська область, місто Львів
5. 01.01.2025, не повернувся додому зі школи
6. Так, заява подана 01.01.2025
```

6. Бот повинен відповісти:

```
✅ Дані збережено!

Наступним повідомленням надішліть фото зниклої людини.
Можна надіслати до 10 фото.

Якщо фото немає, натисніть кнопку "Зараз немає"
```

7. Натисніть "Зараз немає" або надішліть фото

8. Бот повинен відповісти:

```
✅ Заявка відправлена. Ми зв'яжемось з Вами найближчим часом!
...
```

9. Зайдіть в CRM і перевірте що заявка створилась

## Крок 5: Моніторинг

### Перегляд логів у реальному часі

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f telegram-bot
```

### Перезапуск бота

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart telegram-bot
```

### Зупинка бота

```bash
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production stop telegram-bot
```

## Типові проблеми

### Бот не запускається

**Перевірте логи:**
```bash
sudo docker logs crm_telegram_bot
```

**Типова помилка:** `TELEGRAM_BOT_TOKEN не налаштовано!`
- Перевірте що ви додали токен в `.env.production`
- Перевірте що немає пробілів до або після токену
- Перезапустіть бота після додавання токену

### Бот не відповідає

1. **Перевірте що контейнер працює:**
   ```bash
   sudo docker ps | grep telegram-bot
   ```

2. **Перевірте логи:**
   ```bash
   sudo docker logs crm_telegram_bot
   ```

3. **Перезапустіть бота:**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production restart telegram-bot
   ```

### Заявки не створюються в CRM

1. **Перевірте що backend працює:**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production ps backend
   ```

2. **Перевірте логи backend:**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs backend | grep telegram
   ```

3. **Перевірте що endpoint доступний:**
   ```bash
   sudo docker-compose -f docker-compose.prod.yml --env-file .env.production exec telegram-bot curl http://backend:8000/public/health
   ```

   Має повернути: `{"status":"ok","service":"public-api"}`

## Оновлення бота

Коли ви оновили код бота в Git:

```bash
cd ~/MilenaCRM
git pull origin main

# Перезібрати та перезапустити
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build telegram-bot
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d telegram-bot

# Перевірити логи
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f telegram-bot
```

## Додаткова інформація

Для детальної інформації дивіться:
- `telegram-bot/README.md` - Документація бота
- `TELEGRAM_BOT_INTEGRATION.md` - Технічна документація API інтеграції
- `DEPLOYMENT.md` - Загальна документація по deployment

## Контакти підтримки

Якщо виникають проблеми:
1. Перевірте логи бота та backend
2. Перевірте що всі змінні середовища налаштовані правильно
3. Перевірте що OPENAI_API_KEY налаштовано в `.env.production` (для autofill)
