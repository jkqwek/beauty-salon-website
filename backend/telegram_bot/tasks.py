"""
Celery-задача: раз в день ищет записи на завтра и рассылает напоминания.

Подключение в settings.py (если Celery ещё не настроен):

    CELERY_BEAT_SCHEDULE = {
        "send-daily-reminders": {
            "task": "telegram_bot.tasks.send_daily_reminders",
            "schedule": crontab(hour=18, minute=0),  # каждый день в 18:00
        },
    }

Требует: pip install celery redis django-celery-beat (redis — как брокер задач)
"""

from datetime import timedelta
from django.utils import timezone

from celery import shared_task

from telegram_bot.notify import notify_client_reminder

# from appointments.models import Appointment  # раскомментировать, когда модель готова


@shared_task
def send_daily_reminders():
    """Находит записи на завтра и рассылает напоминания клиентам с привязанным chat_id."""
    tomorrow = timezone.now().date() + timedelta(days=1)

    # Пример логики — адаптируйте под реальные поля модели Appointment
    #
    # appointments = Appointment.objects.filter(
    #     date=tomorrow,
    #     status="confirmed",
    #     client__telegram_chat_id__isnull=False,
    # ).select_related("client", "service")
    #
    # sent_count = 0
    # for appointment in appointments:
    #     success = notify_client_reminder(
    #         client_chat_id=appointment.client.telegram_chat_id,
    #         service_name=appointment.service.name,
    #         date_time=f"{appointment.date} {appointment.time}",
    #     )
    #     if success:
    #         sent_count += 1
    #
    # return f"Отправлено напоминаний: {sent_count}"

    return "TODO: раскомментировать логику, когда модель Appointment будет готова"
