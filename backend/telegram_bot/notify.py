"""Отправка уведомлений в Telegram из Django-кода (сигналы, Celery)."""
import json
import os
from html import escape
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"


def _send_message(chat_id, text: str, reply_markup: dict | None = None) -> bool:
    if "test" in sys.argv:  # при запуске тестов ничего не отправляем
        return False
    if not BOT_TOKEN:
        print("BOT_TOKEN не настроен — уведомление не отправлено.")
        return False
    data = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)
    try:
        requests.post(TELEGRAM_API_URL, data=data, timeout=5).raise_for_status()
        return True
    except requests.RequestException as e:
        print(f"Ошибка отправки в Telegram: {e}")
        return False


def notify_admin_new_appointment(client_name, service_name, employee_name, date_time) -> bool:
    if not ADMIN_CHAT_ID:
        print("ADMIN_CHAT_ID не настроен — уведомление не отправлено.")
        return False
    return _send_message(ADMIN_CHAT_ID, (
        "🆕 <b>Новая запись!</b>\n\n"
        f"👤 Клиент: {escape(client_name)}\n💇 Услуга: {escape(service_name)}\n"
        f"👩‍🎨 Мастер: {escape(employee_name)}\n🕒 Время: {date_time}"))


def notify_master_new_booking(master_chat_id, client_name, service_name, date_time) -> bool:
    """Мастеру — о новой записи к нему."""
    return _send_message(master_chat_id, (
        "🆕 <b>У вас новая запись</b>\n\n"
        f"👤 Клиент: {escape(client_name)}\n💇 Услуга: {escape(service_name)}\n🕒 Время: {date_time}"))


def notify_client_reminder(client_chat_id, service_name, date_time) -> bool:
    return _send_message(client_chat_id, (
        "⏰ <b>Напоминание о записи</b>\n\n"
        f"Завтра у вас запись: {escape(service_name)}\nВремя: {date_time}\n\n"
        "Ждём вас в салоне! Если планы изменились — отмените или перенесите запись: /my_bookings"))


def send_survey(client_chat_id, booking_id, service_name) -> bool:
    """Опрос «Как вам услуга?» с кнопками 1–5."""
    buttons = [[{"text": f"{n} ⭐", "callback_data": f"sv:{booking_id}:{n}"} for n in range(1, 6)]]
    return _send_message(client_chat_id, f"Как вам услуга «{escape(service_name)}»? Оцените визит:",
                         {"inline_keyboard": buttons})


def notify_admin_text(text: str) -> bool:
    return bool(ADMIN_CHAT_ID) and _send_message(ADMIN_CHAT_ID, text)
