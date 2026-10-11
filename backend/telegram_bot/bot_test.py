"""
Telegram-бот для салона красоты — УПРОЩЁННАЯ ВЕРСИЯ для первого теста.

Это временный вариант БЕЗ подключения к Django — просто чтобы проверить,
что бот в принципе запускается и отвечает на /start.

Когда бэкенд подруги будет готов, используйте bot.py (полную версию с Django).

Установка:
    pip install python-telegram-bot python-dotenv

Запуск:
    python bot_test.py
"""

import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден. Проверьте файл .env в этой же папке.")

from telegram import Update
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    username = update.effective_user.username or update.effective_user.first_name
    await update.message.reply_text(
        f"Привет, {username}! 👋\n\n"
        "Я бот салона красоты Allure. Пока это тестовая версия — "
        "просто проверяем, что я отвечаю. Скоро подключим настоящую запись!"
    )


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    print("Бот запущен. Откройте его в Telegram и напишите /start")
    print("Нажмите Ctrl+C здесь, чтобы остановить бота.")
    app.run_polling()


if __name__ == "__main__":
    main()
