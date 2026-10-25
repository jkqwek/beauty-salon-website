from collections import defaultdict
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Avg, Q, Sum
from django.utils import timezone

from catalog.models import price_on
from .models import (
    ACTIVE_STATUSES, BONUS_PERCENT, REFERRAL_BONUS, REVIEW_BONUS, BonusOperation, Booking, CancellationPolicy,
    PromoCode, Referral, SalonClosure, Schedule, TimeOff, User,
)

SLOT_STEP = timedelta(minutes=15)
MAX_DAYS_AHEAD = 90  # на сколько дней вперёд можно записаться


def _now():
    return timezone.localtime().replace(tzinfo=None)


def closures_between(date_from, date_to):
    """Праздники и выходные салона, задевающие период."""
    return list(SalonClosure.objects.filter(date_from__lte=date_to, date_to__gte=date_from))


def _slots(day, schedule, busy, closures, duration, now):
    """Свободные начала записи ("HH:MM") — чистый расчёт, без запросов к БД."""
    if schedule is None:  # выходной мастера
        return []
    start, end = schedule.start_time, schedule.end_time
    for c in closures:  # праздники салона на этот день
        if c.is_closed:
            return []
        start, end = max(start, c.open_time), min(end, c.close_time)  # сокращённый день
    current, work_end = datetime.combine(day, start), datetime.combine(day, end)
    slots = []
    while current + duration <= work_end:
        finish = current + duration
        if current > now and not any(current < b_end and b_start < finish for b_start, b_end in busy):
            slots.append(current.strftime("%H:%M"))
        current += SLOT_STEP
    return slots


def _interval(day, start, end):
    return datetime.combine(day, start), datetime.combine(day, end)


def get_free_slots(employee_id, service, target_date, exclude_booking_id=None):
    """Свободные времена начала записи для мастера, услуги и даты.
    exclude_booking_id — переносимая запись: своё же время её не блокирует."""
    schedule = Schedule.objects.filter(employee_id=employee_id, day_of_week=target_date.weekday()).first()
    bookings = Booking.objects.filter(employee_id=employee_id, date=target_date, status__in=ACTIVE_STATUSES)
    busy = [_interval(target_date, b.start_time, b.end_time) for b in bookings.exclude(pk=exclude_booking_id)]
    busy += [_interval(target_date, t.start_time, t.end_time)
             for t in TimeOff.objects.filter(employee_id=employee_id, date=target_date)]
    return _slots(target_date, schedule, busy, closures_between(target_date, target_date),
                  timedelta(minutes=service.duration_minutes), _now())


def available_days(service, employee_ids, date_from, date_to, exclude_booking_id=None):
    """Дни периода, в которые хотя бы у одного из мастеров есть свободное время.
    Данные грузятся пачкой на весь период — это календарь месяца в мастере записи."""
    schedules = {(s.employee_id, s.day_of_week): s for s in Schedule.objects.filter(employee_id__in=employee_ids)}
    busy = defaultdict(list)
    bookings = Booking.objects.filter(employee_id__in=employee_ids, date__range=(date_from, date_to),
                                      status__in=ACTIVE_STATUSES).exclude(pk=exclude_booking_id)
    for b in bookings:
        busy[b.employee_id, b.date].append(_interval(b.date, b.start_time, b.end_time))
    for t in TimeOff.objects.filter(employee_id__in=employee_ids, date__range=(date_from, date_to)):
        busy[t.employee_id, t.date].append(_interval(t.date, t.start_time, t.end_time))
    closures = closures_between(date_from, date_to)
    duration, now = timedelta(minutes=service.duration_minutes), _now()

    days, day = [], date_from
    while day <= date_to:
        day_closures = [c for c in closures if c.date_from <= day <= c.date_to]
        if any(_slots(day, schedules.get((e, day.weekday())), busy[e, day], day_closures, duration, now)
               for e in employee_ids):
            days.append(day)
        day += timedelta(days=1)
    return days


def slot_taken(employee_id, day, start, end, exclude_id=None):
    """Пересекается ли интервал с другой (не отменённой) записью мастера."""
    return (
        Booking.objects.filter(employee_id=employee_id, date=day, start_time__lt=end, end_time__gt=start)
        .exclude(status="cancelled")
        .exclude(pk=exclude_id)
        .exists()
    )


def client_busy(client_id, day, start, end, exclude_id=None):
    """Есть ли у клиента другая активная запись (к любому мастеру), пересекающаяся с интервалом."""
    return (
        Booking.objects.filter(client_id=client_id, date=day, start_time__lt=end, end_time__gt=start,
                               status__in=ACTIVE_STATUSES)
        .exclude(pk=exclude_id)
        .exists()
    )


def cancel_deadline_error(booking):
    """Текст ошибки, если отменять/переносить уже поздно по правилу отмены, иначе None."""
    hours = CancellationPolicy.load().deadline_hours
    start = timezone.make_aware(datetime.combine(booking.date, booking.start_time))
    if start - timezone.now() < timedelta(hours=hours):
        return f"Отменить или перенести запись можно не позднее чем за {hours} ч до начала. Свяжитесь с салоном."
    return None


def reschedule(booking, day, start_time):
    """Перенос клиентом (сайт и бот): те же проверки, что у новой записи. После переноса запись снова
    ждёт подтверждения, а цена пересчитывается по новой дате (акции считаются по дате визита).
    Возвращает текст ошибки или None."""
    if booking.status not in ACTIVE_STATUSES:
        return "Эту запись уже нельзя перенести (она не активна)"
    error = cancel_deadline_error(booking)
    if error:
        return error
    today = timezone.localdate()
    if not today <= day <= today + timedelta(days=MAX_DAYS_AHEAD):
        return f"Перенести можно только на ближайшие {MAX_DAYS_AHEAD} дней."
    free = get_free_slots(booking.employee_id, booking.service, day, exclude_booking_id=booking.pk)
    if start_time.strftime("%H:%M") not in free:
        return "Это время недоступно, выберите другое."
    start = datetime.combine(day, start_time)
    end_time = (start + timedelta(minutes=booking.service.duration_minutes)).time()
    if client_busy(booking.client_id, day, start_time, end_time, exclude_id=booking.pk):
        return "У вас уже есть запись на это время."
    booking.date, booking.start_time, booking.end_time = day, start_time, end_time
    booking.status = "pending"
    booking.price, _ = price_on(booking.service, day)
    if booking.promo_code_id:  # скидка по промокоду сохраняется при переносе
        booking.price = apply_promo(booking.price, booking.promo_code)
    booking.save()
    return None


def recalc_master_rating(employee):
    """Рейтинг мастера = среднее по оценкам клиентов с сайта и из бота."""
    avg = Booking.objects.filter(employee=employee, rating__isnull=False).aggregate(a=Avg("rating"))["a"]
    employee.rating = round(avg, 1) if avg is not None else None
    employee.save(update_fields=["rating"])


def closure_conflicts(date_from, date_to, open_time=None, close_time=None):
    """Активные записи, которые попадают на закрытые дни или выходят за часы сокращённого дня."""
    qs = Booking.objects.filter(date__range=(date_from, date_to), status__in=ACTIVE_STATUSES)
    if open_time and close_time:
        qs = qs.filter(Q(start_time__lt=open_time) | Q(end_time__gt=close_time))
    return qs.select_related("client", "service", "employee").order_by("date", "start_time")


def conflict_label(b):
    client = b.client.get_full_name() or b.client.username
    return f"{b.date:%d.%m} {b.start_time:%H:%M} — {client}, {b.service.name} ({b.employee.full_name})"


def visit_bonus(booking):
    """Баллы за визит: BONUS_PERCENT от цены (уже со скидкой), дробная часть отбрасывается."""
    if booking.status != "completed" or not booking.price:
        return 0
    return int(booking.price * BONUS_PERCENT / 100)


def sync_visit_bonus(booking):
    """Начисление за визит есть, только пока запись выполнена; сменилась цена — пересчитывается."""
    points = visit_bonus(booking)
    if not points:
        BonusOperation.objects.filter(booking=booking).delete()
        return
    BonusOperation.objects.update_or_create(
        booking=booking,
        defaults={"client_id": booking.client_id, "amount": points, "comment": f"За визит: {booking.service.name}"},
    )


def bonus_balance(user):
    return user.bonus_operations.aggregate(total=Sum("amount"))["total"] or 0


# ---------- промокоды ----------

def find_promo(code, user):
    """Промокод для клиента: (промокод, None) или (None, текст ошибки). Пустой код — (None, None)."""
    code = (code or "").strip().upper()
    if not code:
        return None, None
    promo = PromoCode.objects.filter(code=code, is_active=True).first()
    today = timezone.localdate()
    if not promo or (promo.valid_from and today < promo.valid_from) or (promo.valid_to and today > promo.valid_to):
        return None, "Промокод не найден или не действует."
    used = promo.bookings.exclude(status="cancelled")
    if promo.max_uses is not None and used.count() >= promo.max_uses:
        return None, "Лимит использований промокода исчерпан."
    if used.filter(client=user).exists():
        return None, "Вы уже использовали этот промокод."
    return promo, None


def apply_promo(price, promo):
    """Цена со скидкой по промокоду (округление до рубля, как у акций)."""
    price = (price * (100 - promo.discount_percent) / 100).quantize(Decimal("1"), ROUND_HALF_UP)
    return price.quantize(Decimal("0.01"))


# ---------- уровни лояльности ----------

LOYALTY_LEVELS = [  # от высшего к низшему: (ключ, название, порог суммы выполненных визитов, ₽)
    ("gold", "Золото", Decimal(30000)),
    ("silver", "Серебро", Decimal(10000)),
    ("bronze", "Бронза", Decimal(0)),
]


def level_for(spent):
    """Уровень по сумме выполненных визитов: ключ, название, сколько ₽ до следующего уровня."""
    spent = Decimal(spent or 0)
    for i, (key, name, threshold) in enumerate(LOYALTY_LEVELS):
        if spent >= threshold:
            upper = LOYALTY_LEVELS[i - 1] if i else None
            return {
                "key": key, "name": name, "total_spent": str(spent),
                "next_level": upper[1] if upper else None,
                "to_next": str(upper[2] - spent) if upper else None,
            }


def loyalty(user):
    spent = Booking.objects.filter(client=user, status="completed").aggregate(s=Sum("price"))["s"]
    return level_for(spent)


# ---------- бонусы за отзыв и «приведи друга» ----------

def sync_review_bonus(review):
    """Баллы за отзыв — один раз, когда салон его опубликовал."""
    if review.status == "published":
        BonusOperation.objects.get_or_create(
            review=review,
            defaults={"client_id": review.booking.client_id, "amount": REVIEW_BONUS, "comment": "За отзыв"},
        )


REF_PREFIX = "ALLURE-"


def ref_code(user):
    return f"{REF_PREFIX}{user.pk}"


def find_referrer(code):
    code = (code or "").strip().upper()
    number = code[len(REF_PREFIX):]
    if not code.startswith(REF_PREFIX) or not number.isdigit():
        return None
    return User.objects.filter(pk=int(number)).first()


def reward_referral(booking):
    """Первый выполненный визит приглашённого друга: баллы и ему, и пригласившему — один раз."""
    if booking.status != "completed":
        return
    referral = Referral.objects.filter(friend_id=booking.client_id, rewarded=False).first()
    if referral and Referral.objects.filter(pk=referral.pk, rewarded=False).update(rewarded=True):
        BonusOperation.objects.create(client_id=referral.referrer_id, amount=REFERRAL_BONUS,
                                      comment="Приведи друга: друг пришёл на визит")
        BonusOperation.objects.create(client_id=referral.friend_id, amount=REFERRAL_BONUS,
                                      comment="Приведи друга: бонус за первый визит")
