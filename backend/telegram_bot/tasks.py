"""Celery-задачи бота: напоминания, опрос после визита, свободные окна на завтра."""
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from bookings.models import ACTIVE_STATUSES, Booking
from bookings.services import get_free_slots
from catalog.models import Employee
from telegram_bot.notify import (notify_admin_text, notify_client_reminder, send_survey)


@shared_task
def send_daily_reminders():
    """Напоминания клиентам о записях на завтра."""
    tomorrow = timezone.localdate() + timedelta(days=1)
    bookings = Booking.objects.filter(
        date=tomorrow, status__in=ACTIVE_STATUSES,
        client__profile__telegram_chat_id__isnull=False,
    ).exclude(client__profile__telegram_chat_id="").select_related("client__profile", "service")
    sent = sum(
        notify_client_reminder(b.client.profile.telegram_chat_id, b.service.name,
                               f"{b.date:%d.%m} {b.start_time:%H:%M}")
        for b in bookings
    )
    return f"Отправлено напоминаний: {sent}"


@shared_task
def send_surveys():
    """Опрос после визита: для завершённых записей, по которым ещё не спрашивали."""
    bookings = Booking.objects.filter(
        status="completed", survey_sent=False,
        client__profile__telegram_chat_id__isnull=False,
    ).exclude(client__profile__telegram_chat_id="").select_related("client__profile", "service")
    sent = 0
    for b in bookings:
        if send_survey(b.client.profile.telegram_chat_id, b.id, b.service.name):
            b.survey_sent = True
            b.save(update_fields=["survey_sent"])
            sent += 1
    return f"Отправлено опросов: {sent}"


@shared_task
def notify_free_windows():
    """Администратору: свободные окна у мастеров на завтра."""
    day = timezone.localdate() + timedelta(days=1)
    lines = []
    for e in Employee.objects.filter(is_active=True).prefetch_related("services").order_by("full_name"):
        service = min(e.services.filter(is_active=True), key=lambda s: s.duration_minutes, default=None)
        slots = get_free_slots(e.pk, service, day) if service else []
        if slots:
            lines.append(f"👩‍🎨 <b>{e.full_name}</b>: {', '.join(slots)}")
    if not lines:
        return "Свободных окон нет"
    notify_admin_text(f"🕒 <b>Свободные окна на {day:%d.%m}</b>\n\n" + "\n".join(lines))
    return f"Мастеров со свободными окнами: {len(lines)}"
