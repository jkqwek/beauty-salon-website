from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Booking
from telegram_bot.notify import notify_admin_new_appointment


@receiver(post_save, sender=Booking)
def send_admin_notification(sender, instance, created, **kwargs):
    """
    Срабатывает каждый раз, когда объект Booking сохраняется в базу.
    created=True — только если это НОВАЯ запись (а не обновление существующей).
    """
    if not created:
        return  # если это не новая запись (например, изменили статус) — не шлём уведомление

    notify_admin_new_appointment(
        client_name=instance.client.get_full_name() or instance.client.username,
        service_name=instance.service.name,
        employee_name=str(instance.employee),
        date_time=f"{instance.date} {instance.start_time}",
    )