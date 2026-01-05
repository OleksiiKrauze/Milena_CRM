"""
Telegram бот для прийому заявок про зниклих осіб
Інтеграція з MilenaCRM
"""
import os
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
import aiohttp

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Конфігурація
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CRM_API_URL = os.getenv("CRM_API_URL", "http://backend:8000")
CRM_API_KEY = os.getenv("CRM_API_KEY", "")

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN не налаштовано!")

# Ініціалізація бота
bot = Bot(token=TELEGRAM_BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)


# FSM стани
class CaseForm(StatesGroup):
    waiting_for_info = State()
    waiting_for_photo = State()


# Текст інструкції
INSTRUCTION_TEXT = """Доброго дня, надайте відповідь на наступні запитання одним повідомленням:

1. Заявник (ПІБ) та ким він є зниклій людині?
2. Контакти заявника: телефон для зв'язку?
3. ПІБ та дата народження зниклої людини?
4. Область та населений пункт зникнення людини?
5. Дата та обставини зникнення?
6. Чи була подана заява до поліції?"""


@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    """Обробка команди /start"""
    await state.clear()

    await message.answer(
        "Якщо Ви припустилися помилки при заповненні форми, або вказали не всі дані - "
        "перезапустіть форму знову, відправивши повідомлення /start\n\n" + INSTRUCTION_TEXT
    )

    await state.set_state(CaseForm.waiting_for_info)
    logger.info(f"User {message.from_user.id} started new case submission")


@dp.message(CaseForm.waiting_for_info, F.text)
async def process_case_info(message: types.Message, state: FSMContext):
    """Обробка текстової інформації про заявку"""

    await message.answer("⏳ Обробляю інформацію...")

    # Відправляємо дані в CRM
    headers = {"Content-Type": "application/json"}
    if CRM_API_KEY:
        headers["X-API-Key"] = CRM_API_KEY

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{CRM_API_URL}/public/telegram/case",
                json={"initial_info": message.text},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status == 201:
                    result = await resp.json()
                    case_id = result["case_id"]

                    # Зберігаємо case_id в state
                    await state.update_data(case_id=case_id)
                    await state.set_state(CaseForm.waiting_for_photo)

                    logger.info(f"Case {case_id} created for user {message.from_user.id}")

                    # Клавіатура з кнопкою "Зараз немає"
                    keyboard = ReplyKeyboardMarkup(
                        keyboard=[[KeyboardButton(text="Зараз немає")]],
                        resize_keyboard=True,
                        one_time_keyboard=True
                    )

                    await message.answer(
                        "✅ Дані збережено!\n\n"
                        "Наступним повідомленням надішліть фото зниклої людини.\n"
                        "Можна надіслати до 10 фото.\n\n"
                        "Якщо фото немає, натисніть кнопку \"Зараз немає\"",
                        reply_markup=keyboard
                    )
                else:
                    error_data = await resp.json()
                    error_message = error_data.get('error', {}).get('message', 'Невідома помилка')

                    logger.error(f"Error creating case: {error_message}")

                    await message.answer(
                        f"❌ Помилка при створенні заявки:\n{error_message}\n\n"
                        "Спробуйте ще раз або відправте /start для перезапуску."
                    )
                    await state.clear()

        except aiohttp.ClientError as e:
            logger.error(f"Network error: {e}")
            await message.answer(
                "❌ Помилка зв'язку з сервером. Спробуйте пізніше.\n\n"
                "Або відправте /start для перезапуску."
            )
            await state.clear()
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            await message.answer(
                "❌ Виникла несподівана помилка. Спробуйте пізніше.\n\n"
                "Або відправте /start для перезапуску."
            )
            await state.clear()


@dp.message(CaseForm.waiting_for_photo, F.text == "Зараз немає")
async def no_photo(message: types.Message, state: FSMContext):
    """Користувач вказав що фото немає"""
    data = await state.get_data()
    case_id = data.get('case_id')

    logger.info(f"User {message.from_user.id} submitted case {case_id} without photos")

    await message.answer(
        "✅ Заявка відправлена. Ми зв'яжемось з Вами найближчим часом!\n\n"
        "Якщо Ви припустилися помилки при заповненні форми, або вказали не всі дані - "
        "перезапустіть форму знову, відправивши повідомлення /start",
        reply_markup=types.ReplyKeyboardRemove()
    )

    await state.clear()


@dp.message(CaseForm.waiting_for_photo, F.photo)
async def process_photo(message: types.Message, state: FSMContext):
    """Обробка фото від користувача"""
    data = await state.get_data()
    case_id = data.get('case_id')

    if not case_id:
        await message.answer(
            "❌ Помилка: заявка не знайдена.\n\n"
            "Відправте /start щоб почати спочатку."
        )
        await state.clear()
        return

    # Отримуємо список вже завантажених фото
    uploaded_photos = data.get('uploaded_photos', [])

    # Перевіряємо ліміт
    if len(uploaded_photos) >= 10:
        await message.answer(
            "⚠️ Досягнуто максимум 10 фото.\n\n"
            "Натисніть кнопку \"Зараз немає\" щоб завершити."
        )
        return

    await message.answer("⏳ Завантажую фото...")

    # Завантажуємо фото
    photo = message.photo[-1]  # Найбільший розмір
    file = await bot.get_file(photo.file_id)
    photo_bytes = await bot.download_file(file.file_path)

    # Відправляємо в CRM
    headers = {}
    if CRM_API_KEY:
        headers["X-API-Key"] = CRM_API_KEY

    async with aiohttp.ClientSession() as session:
        form = aiohttp.FormData()
        form.add_field(
            'files',
            photo_bytes,
            filename=f'photo_{photo.file_id}.jpg',
            content_type='image/jpeg'
        )

        try:
            async with session.post(
                f"{CRM_API_URL}/public/telegram/case/{case_id}/photos",
                data=form,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    uploaded_photos.append(photo.file_id)
                    await state.update_data(uploaded_photos=uploaded_photos)

                    logger.info(f"Photo uploaded to case {case_id}, total: {len(uploaded_photos)}")

                    remaining = 10 - len(uploaded_photos)
                    await message.answer(
                        f"✅ Фото завантажено! (Завантажено: {len(uploaded_photos)}/10)\n\n"
                        f"Можете надіслати ще {remaining} фото або натисніть \"Зараз немає\" щоб завершити."
                    )
                else:
                    error_data = await resp.json()
                    error_message = error_data.get('error', {}).get('message', 'Невідома помилка')

                    logger.error(f"Error uploading photo: {error_message}")

                    await message.answer(
                        f"❌ Помилка при завантаженні фото:\n{error_message}\n\n"
                        "Спробуйте надіслати інше фото або натисніть \"Зараз немає\"."
                    )

        except aiohttp.ClientError as e:
            logger.error(f"Network error uploading photo: {e}")
            await message.answer(
                "❌ Помилка зв'язку з сервером.\n\n"
                "Спробуйте надіслати фото ще раз або натисніть \"Зараз немає\"."
            )
        except Exception as e:
            logger.error(f"Unexpected error uploading photo: {e}", exc_info=True)
            await message.answer(
                "❌ Виникла несподівана помилка.\n\n"
                "Спробуйте надіслати фото ще раз або натисніть \"Зараз немає\"."
            )


@dp.message(CaseForm.waiting_for_photo)
async def invalid_photo_input(message: types.Message):
    """Обробка невалідного вводу замість фото"""
    await message.answer(
        "⚠️ Будь ласка, надішліть фото або натисніть кнопку \"Зараз немає\".\n\n"
        "Якщо хочете почати спочатку, відправте /start"
    )


@dp.message()
async def handle_other_messages(message: types.Message):
    """Обробка інших повідомлень"""
    await message.answer(
        "Щоб створити заявку про зниклого, відправте команду /start"
    )


async def on_startup():
    """Дії при запуску бота"""
    logger.info("Telegram bot started!")
    logger.info(f"CRM API URL: {CRM_API_URL}")
    logger.info(f"API Key configured: {'Yes' if CRM_API_KEY else 'No'}")


async def on_shutdown():
    """Дії при зупинці бота"""
    logger.info("Telegram bot stopped!")


async def main():
    """Головна функція"""
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Видаляємо вебхук якщо був встановлений
    await bot.delete_webhook(drop_pending_updates=True)

    # Запускаємо polling
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
