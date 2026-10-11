# bookings/signals.py (замени файл целиком)
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Booking
from telegram_bot.notify import notify_admin_new_appointment, notify_master_new_booking


@receiver(post_save, sender=Booking)
def send_booking_notifications(sender, instance, created, **kwargs):
    """Новая запись → уведомление админу и мастеру (если мастер привязал Telegram)."""
    if not created:
        return
    client_name = instance.client.get_full_name() or instance.client.username
    when = f"{instance.date:%d.%m.%Y} {instance.start_time:%H:%M}"

    notify_admin_new_appointment(client_name, instance.service.name, instance.employee.full_name, when)

    master_user = instance.employee.user
    profile = getattr(master_user, "profile", None) if master_user else None
    if profile and profile.telegram_chat_id:
        notify_master_new_booking(profile.telegram_chat_id, client_name, instance.service.name, when)
