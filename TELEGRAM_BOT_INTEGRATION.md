# Інтеграція Telegram бота з MilenaCRM

## Огляд

Цей документ описує інтеграцію Telegram бота з CRM системою для автоматичного створення заявок про зниклих осіб.

## API Endpoints

### 1. Створення заявки з текстовою інформацією

**Endpoint:** `POST /public/telegram/case`

**Опис:** Створює нову заявку з текстової інформації, автоматично розпарсовує дані через OpenAI та відправляє пуш-уведомлення.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: YOUR_API_KEY` (опціонально, якщо налаштовано `PUBLIC_API_KEY`)

**Request Body:**
```json
{
  "initial_info": "0506316743 - Оксана, мати. Син Максим Іванов, 15 років. Зник 5 днів тому з міста Львів. Був у синій куртці."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Заявку успішно створено. Дані автоматично розпарсовано.",
  "case_id": 158
}
```

**Response (Error):**
```json
{
  "error": {
    "status_code": 400,
    "message": "Помилка валідації даних: ...",
    "path": "/public/telegram/case"
  }
}
```

**Що відбувається:**
1. Система зберігає текст в поле `initial_info`
2. Автоматично викликає OpenAI для розбору даних (якщо налаштовано `OPENAI_API_KEY`)
3. Створює заявку з розпарсеними даними або мінімальними даними якщо autofill не вдався
4. Встановлює `basis="Заявка з Telegram"` та `tags=["Заявка з Telegram"]`
5. Відправляє пуш-уведомлення всім користувачам з правом `cases:read`
6. Повертає ID створеної заявки

---

### 2. Додавання фото до заявки

**Endpoint:** `POST /public/telegram/case/{case_id}/photos`

**Опис:** Додає фотографії до існуючої заявки.

**Headers:**
- `Content-Type: multipart/form-data`
- `X-API-Key: YOUR_API_KEY` (опціонально)

**Request:** Multipart form with image files
- Поле: `files` (може бути кілька файлів)
- Максимум 10 файлів за раз
- Максимальний розмір файлу: 10 MB
- Підтримувані формати: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`

**Response (Success):**
```json
{
  "success": true,
  "message": "Успішно завантажено 2 фото",
  "photos_count": 2,
  "photo_urls": [
    "/uploads/uuid1_photo.jpg",
    "/uploads/uuid2_photo.jpg"
  ]
}
```

**Response (Error - Case Not Found):**
```json
{
  "error": {
    "status_code": 404,
    "message": "Заявку з ID 123 не знайдено",
    "path": "/public/telegram/case/123/photos"
  }
}
```

---

## Приклад інтеграції з Telegram ботом (Python + aiogram)

### Встановлення залежностей

```bash
pip install aiogram aiohttp
```

### Код бота

```python
import os
import aiohttp
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command

# Конфігурація
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CRM_API_URL = "https://crm.przmilena.click"  # Production
# CRM_API_URL = "http://localhost:8000"  # Local development
CRM_API_KEY = os.getenv("CRM_API_KEY")  # Опціонально

bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher()

# Словник для зберігання тимчасових даних користувача
user_data = {}


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "Вітаю! Я бот для прийому заявок про зниклих осіб.\n\n"
        "Надішліть мені інформацію про зниклого:\n"
        "- ПІБ та контакти заявника\n"
        "- ПІБ зниклої особи\n"
        "- Обставини зникнення\n"
        "- Будь-яку іншу важливу інформацію\n\n"
        "Після цього можете надіслати фото (до 10 фото)."
    )


@dp.message(lambda message: message.content_type == "text" and message.text and not message.text.startswith("/"))
async def handle_text_message(message: types.Message):
    """Обробка текстової інформації про заявку"""

    await message.answer("Обробляю інформацію...")

    async with aiohttp.ClientSession() as session:
        headers = {"Content-Type": "application/json"}
        if CRM_API_KEY:
            headers["X-API-Key"] = CRM_API_KEY

        try:
            async with session.post(
                f"{CRM_API_URL}/public/telegram/case",
                json={"initial_info": message.text},
                headers=headers
            ) as resp:
                if resp.status == 201:
                    result = await resp.json()
                    case_id = result["case_id"]
                    user_data[message.from_user.id] = case_id

                    await message.answer(
                        f"✅ {result['message']}\n\n"
                        f"Заявка #{case_id} успішно створена!\n\n"
                        "Тепер можете надіслати фото зниклої особи (до 10 фото).\n"
                        "Якщо фото немає, використайте команду /done"
                    )
                else:
                    error_data = await resp.json()
                    await message.answer(
                        f"❌ Помилка при створенні заявки:\n{error_data.get('error', {}).get('message', 'Невідома помилка')}"
                    )

        except Exception as e:
            await message.answer(f"❌ Помилка зв'язку з сервером: {str(e)}")


@dp.message(lambda message: message.content_type == "photo")
async def handle_photo(message: types.Message):
    """Обробка фото від користувача"""

    user_id = message.from_user.id
    if user_id not in user_data:
        await message.answer(
            "⚠️ Спочатку надішліть текстову інформацію про заявку."
        )
        return

    case_id = user_data[user_id]

    # Завантажуємо фото
    photo = message.photo[-1]  # Найбільший розмір
    file = await bot.get_file(photo.file_id)
    photo_bytes = await bot.download_file(file.file_path)

    # Надсилаємо до CRM
    async with aiohttp.ClientSession() as session:
        form = aiohttp.FormData()
        form.add_field(
            'files',
            photo_bytes,
            filename=f'photo_{photo.file_id}.jpg',
            content_type='image/jpeg'
        )

        headers = {}
        if CRM_API_KEY:
            headers["X-API-Key"] = CRM_API_KEY

        try:
            async with session.post(
                f"{CRM_API_URL}/public/telegram/case/{case_id}/photos",
                data=form,
                headers=headers
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    await message.answer(
                        f"✅ Фото успішно додано до заявки #{case_id}\n"
                        f"Завантажено: {result['photos_count']} фото"
                    )
                else:
                    error_data = await resp.json()
                    await message.answer(
                        f"❌ Помилка при завантаженні фото:\n{error_data.get('error', {}).get('message', 'Невідома помилка')}"
                    )

        except Exception as e:
            await message.answer(f"❌ Помилка зв'язку з сервером: {str(e)}")


@dp.message(Command("done"))
async def cmd_done(message: types.Message):
    """Завершення роботи з заявкою"""
    user_id = message.from_user.id
    if user_id in user_data:
        case_id = user_data.pop(user_id)
        await message.answer(
            f"✅ Робота з заявкою #{case_id} завершена.\n\n"
            "Дякуємо! Наша команда зв'яжеться з вами найближчим часом.\n\n"
            "Щоб створити нову заявку, просто надішліть текстову інформацію."
        )
    else:
        await message.answer(
            "⚠️ Немає активної заявки.\n\n"
            "Щоб створити нову заявку, надішліть текстову інформацію про зниклого."
        )


async def main():
    print("Бот запущено!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

---

## Тестування локально

### 1. Тестування створення заявки

```bash
curl -X POST http://localhost:8000/public/telegram/case \
  -H "Content-Type: application/json" \
  -d '{
    "initial_info": "0506316743 - Оксана, мати. Син Максим Іванов, 15 років. Зник 5 днів тому з міста Львів. Був у синій куртці."
  }'
```

**Очікувана відповідь:**
```json
{
  "success": true,
  "message": "Заявку успішно створено. Дані автоматично розпарсовано.",
  "case_id": 158
}
```

### 2. Тестування завантаження фото

```bash
curl -X POST http://localhost:8000/public/telegram/case/158/photos \
  -F "files=@photo1.jpg" \
  -F "files=@photo2.jpg"
```

**Очікувана відповідь:**
```json
{
  "success": true,
  "message": "Успішно завантажено 2 фото",
  "photos_count": 2,
  "photo_urls": [
    "/uploads/uuid1_photo.jpg",
    "/uploads/uuid2_photo.jpg"
  ]
}
```

---

## Deployment на Production

### 1. Налаштування змінних середовища

Додайте до `.env.production`:

```bash
# Опціонально: API key для захисту публічних endpoints
PUBLIC_API_KEY=your_secret_api_key_here
```

### 2. Перезапуск сервісів

```bash
cd ~/MilenaCRM

# Перезібрати backend
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production build backend

# Перезапустити
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Перевірити логи
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f backend
```

### 3. Передати API key розробнику Telegram бота

Якщо ви налаштували `PUBLIC_API_KEY`, передайте його розробнику бота для використання в заголовку `X-API-Key`.

---

## Налаштування Push уведомлень

### На Frontend

Після deployment, користувачі зможуть налаштувати отримання пуш-уведомлень для "Нова заявка з Telegram" в своєму профілі.

### Автоматичне сповіщення

При створенні заявки через Telegram, автоматично відправляються пуш-уведомлення всім активним користувачам які:
- Мають дозвіл `cases:read` (ролі: admin, coordinator, operator)
- Увімкнули уведомлення типу `new_telegram_case`

---

## Rate Limiting

Обидва endpoints захищені rate limiting:
- **5 запитів на 60 секунд** per IP address
- При перевищенні ліміту повертається HTTP 429 (Too Many Requests)

---

## Обробка помилок

### Типові помилки та їх обробка

| HTTP Code | Опис | Рішення |
|-----------|------|---------|
| 400 | Помилка валідації даних | Перевірте формат запиту |
| 401 | Невірний API key | Перевірте `X-API-Key` header |
| 404 | Заявку не знайдено | Перевірте case_id |
| 429 | Перевищено rate limit | Зачекайте 60 секунд |
| 500 | Внутрішня помилка сервера | Перевірте логи backend |

---

## Моніторинг

### Перевірка логів

```bash
# Production
sudo docker-compose -f docker-compose.prod.yml --env-file .env.production logs -f backend | grep "Telegram"

# Local
docker logs milenacrm-backend-1 | grep "Telegram"
```

### Приклад логів

```
2026-01-05 21:36:00 - app.routers.public - INFO - Telegram case submission from IP: 172.18.0.1
2026-01-05 21:36:07 - app.routers.public - INFO - OpenAI autofill successful for Telegram case
2026-01-05 21:36:07 - app.routers.public - INFO - Telegram case created successfully: ID=158, IP=172.18.0.1, Autofill=yes
```

---

## Підтримка

Якщо виникають питання або проблеми:
1. Перевірте логи backend
2. Переконайтеся що `OPENAI_API_KEY` налаштовано (для autofill)
3. Перевірте що `PUBLIC_API_KEY` співпадає між backend та bot (якщо використовується)
4. Переконайтеся що VAPID ключі налаштовані (для push notifications)
