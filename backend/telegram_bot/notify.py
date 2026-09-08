"""
Функции для отправки уведомлений в Telegram из Django-кода
(например, из сериализатора или сигнала post_save модели Appointment).

Использование в Django:

    from telegram_bot.notify import notify_admin_new_appointment

    notify_admin_new_appointment(
        client_name="Иван Иванов",
        service_name="Стрижка",
        employee_name="Мария",
        date_time="2026-09-10 15:00",
    )
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")

TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def _send_message(chat_id: str, text: str) -> bool:
    """Низкоуровневая отправка сообщения через Telegram HTTP API.
    Используем requests, а не библиотеку бота — так проще вызывать
    синхронно из обычного Django-кода (сериализаторы, сигналы, view).
    """
    if not BOT_TOKEN:
        print("BOT_TOKEN не настроен — уведомление не отправлено.")
        return False

    try:
        response = requests.post(
            TELEGRAM_API_URL,
            data={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=5,
        )
        response.raise_for_status()
        return True
    except requests.RequestException as e:
        # В реальном проекте лучше залогировать через logging, а не print
        print(f"Ошибка отправки в Telegram: {e}")
        return False


def notify_admin_new_appointment(
    client_name: str,
    service_name: str,
    employee_name: str,
    date_time: str,
) -> bool:
    """Уведомление админу о новой записи."""
    if not ADMIN_CHAT_ID:
        print("ADMIN_CHAT_ID не настроен — уведомление не отправлено.")
        return False

    text = (
        "🆕 <b>Новая запись!</b>\n\n"
        f"👤 Клиент: {client_name}\n"
        f"💇 Услуга: {service_name}\n"
        f"👩‍🎨 Мастер: {employee_name}\n"
        f"🕒 Время: {date_time}"
    )
    return _send_message(ADMIN_CHAT_ID, text)


def notify_client_reminder(client_chat_id: str, service_name: str, date_time: str) -> bool:
    """Напоминание клиенту о завтрашней записи (вызывается из Celery-задачи)."""
    text = (
        "⏰ <b>Напоминание о записи</b>\n\n"
        f"Завтра у вас запись: {service_name}\n"
        f"Время: {date_time}\n\n"
        "Ждём вас в салоне! Если планы изменились — отмените или перенесите запись в личном кабинете."
    )
    return _send_message(client_chat_id, text)
