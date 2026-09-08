"""
Telegram-бот для салона красоты.

Что делает:
- /start — приветствие + сохранение chat_id пользователя (для будущих напоминаний)
- Умеет отправлять уведомление админу о новой записи (см. notify.py)

Установка:
    pip install python-telegram-bot python-dotenv django

Запуск (отдельный процесс, НЕ через runserver):
    python telegram_bot/bot.py
"""

import os
import sys
import django
from dotenv import load_dotenv

# --- 1. Загружаем переменные окружения из .env ---
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")  # chat_id администратора/группы

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден. Добавьте его в .env файл.")

# --- 2. Подключаем Django, чтобы использовать модели прямо в боте ---
# Путь до проекта — поправьте под структуру своего репозитория
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")  # <-- замените config на имя вашего проекта
django.setup()

# Импортируем модели ПОСЛЕ django.setup()
# from appointments.models import Appointment  # раскомментируйте, когда модель будет готова
# from users.models import CustomUser

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start — сохраняем chat_id клиента."""
    chat_id = update.effective_chat.id
    username = update.effective_user.username or update.effective_user.first_name

    # TODO: связать chat_id с пользователем в базе.
    # Обычно делают так: клиент вводит в боте свой email/телефон,
    # которым регистрировался на сайте, и вы находите нужного User и сохраняете chat_id.
    #
    # Пример (когда модель будет готова):
    # user = CustomUser.objects.filter(phone=phone_from_message).first()
    # if user:
    #     user.telegram_chat_id = chat_id
    #     user.save()

    await update.message.reply_text(
        f"Привет, {username}! 👋\n\n"
        "Я бот салона красоты. Буду присылать напоминания о ваших записях.\n"
        "Чтобы я мог это делать, свяжите аккаунт: отправьте мне номер телефона, "
        "который вы указывали при регистрации на сайте."
    )


async def handle_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Простой обработчик текста — ожидаем номер телефона для привязки."""
    text = update.message.text
    chat_id = update.effective_chat.id

    # TODO: здесь должна быть настоящая логика поиска пользователя по номеру
    # и сохранения chat_id. Пока — заглушка.
    await update.message.reply_text(
        f"Получил номер: {text}\nПривязка аккаунта пока не реализована — это TODO."
    )


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))

    from telegram.ext import MessageHandler, filters
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_phone))

    print("Бот запущен. Нажмите Ctrl+C для остановки.")
    app.run_polling()


if __name__ == "__main__":
    main()
