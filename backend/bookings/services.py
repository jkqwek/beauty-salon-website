from datetime import datetime, timedelta

from django.utils import timezone

from .models import Booking, Schedule, TimeOff

SLOT_STEP = timedelta(minutes=15)
MAX_DAYS_AHEAD = 90  # на сколько дней вперёд можно записаться


def get_free_slots(employee_id, service, target_date):
    """Свободные времена начала записи ("HH:MM") для мастера, услуги и даты."""
    schedule = Schedule.objects.filter(
        employee_id=employee_id, day_of_week=target_date.weekday()
    ).first()
    if not schedule:  # выходной
        return []

    duration = timedelta(minutes=service.duration_minutes)
    busy = [
        (datetime.combine(target_date, b.start_time), datetime.combine(target_date, b.end_time))
        for b in Booking.objects.filter(
            employee_id=employee_id, date=target_date, status="active"
        )
    ] + [
        (datetime.combine(target_date, t.start_time), datetime.combine(target_date, t.end_time))
        for t in TimeOff.objects.filter(employee_id=employee_id, date=target_date)
    ]

    now = timezone.localtime().replace(tzinfo=None)
    current = datetime.combine(target_date, schedule.start_time)
    work_end = datetime.combine(target_date, schedule.end_time)

    slots = []
    while current + duration <= work_end:
        end = current + duration
        is_past = current <= now
        is_busy = any(current < b_end and b_start < end for b_start, b_end in busy)
        if not is_past and not is_busy:
            slots.append(current.strftime("%H:%M"))
        current += SLOT_STEP
    return slots