"""
Telegram-бот для салона красоты.

Что делает:
- /start — приветствие + привязка chat_id клиента к его аккаунту на сайте
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
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден. Добавьте его в .env файл.")

# --- 2. Подключаем Django ---
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

# Импортируем модели ПОСЛЕ django.setup()
from django.contrib.auth import get_user_model
from bookings.models import ClientProfile
from asgiref.sync import sync_to_async

User = get_user_model()

from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    ContextTypes,
)


def _link_telegram_profile(user_id, chat_id):
    """
    Синхронная функция для работы с базой (Django ORM синхронный).
    Вызывается из async-обработчика через sync_to_async.
    Возвращает объект User, если привязка удалась, иначе None.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None

    profile, _ = ClientProfile.objects.get_or_create(user=user)
    profile.telegram_chat_id = chat_id
    profile.save()
    return user


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработчик /start.
    Если пришли по ссылке вида https://t.me/бот?start=5,
    то '5' — это id пользователя на сайте, привязываем его chat_id.
    """
    chat_id = update.effective_chat.id
    args = context.args

    if args:
        user_id = args[0]
        user = await sync_to_async(_link_telegram_profile)(user_id, chat_id)
        if user:
            await update.message.reply_text(
                f"Готово, {user.first_name or user.username}! ✅\n"
                "Теперь я буду присылать вам напоминания о записях."
            )
            return

    await update.message.reply_text(
        "Привет! 👋\n\n"
        "Чтобы получать напоминания о записях, зайдите в личный кабинет "
        "на сайте и нажмите там кнопку «Подключить Telegram»."
    )


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))

    print("Бот запущен. Нажмите Ctrl+C для остановки.")
    app.run_polling()


if __name__ == "__main__":
    main()