from datetime import datetime
from decimal import Decimal

from django.db.models import Count, DecimalField, Sum
from django.db.models.functions import Coalesce
from rest_framework.exceptions import ValidationError

from bookings.models import Booking

ZERO = Decimal("0")
LOST = Coalesce("price", "service__price", output_field=DecimalField(max_digits=12, decimal_places=2))


def parse_date(params, name):
    value = params.get(name)
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({name: "Формат ГГГГ-ММ-ДД."})


def date_range(params):
    d_from, d_to = parse_date(params, "date_from"), parse_date(params, "date_to")
    if d_from and d_to and d_to < d_from:
        raise ValidationError({"date_to": "Дата «по» не может быть раньше даты «с»."})
    return d_from, d_to


def _in_range(qs, d_from, d_to):
    if d_from:
        qs = qs.filter(date__gte=d_from)
    if d_to:
        qs = qs.filter(date__lte=d_to)
    return qs


def popular_services(d_from=None, d_to=None):
    rows = (
        _in_range(Booking.objects.filter(status="completed"), d_from, d_to)
        .values("service_id", "service__name", "service__deleted_at")
        .annotate(bookings_count=Count("id"), revenue=Sum("price"))
    )
    items = [
        {
            "service_id": r["service_id"],
            "service_name": r["service__name"] + (" (удалена)" if r["service__deleted_at"] else ""),
            "bookings_count": r["bookings_count"],
            "revenue": r["revenue"] or ZERO,
        }
        for r in rows
    ]
    total = sum((i["revenue"] for i in items), ZERO)
    for i in items:
        i["avg_check"] = (i["revenue"] / i["bookings_count"]).quantize(Decimal("0.01"))
        i["share_percent"] = round(float(i["revenue"] / total * 100), 1) if total else 0
    items.sort(key=lambda i: (-i["revenue"], -i["bookings_count"], i["service_name"]))
    return items


def cancellations(d_from=None, d_to=None):
    in_period = _in_range(Booking.objects.all(), d_from, d_to)
    cancelled = in_period.filter(status="cancelled").annotate(lost_amount=LOST)

    totals = cancelled.aggregate(n=Count("id"), lost=Sum("lost_amount"))
    bookings_total = in_period.count()
    cancelled_count = totals["n"]

    by_service = [
        {
            "service_id": r["service_id"],
            "service_name": r["service__name"] + (" (удалена)" if r["service__deleted_at"] else ""),
            "cancelled_count": r["n"],
            "lost_revenue": r["lost"] or ZERO,
        }
        for r in cancelled.values("service_id", "service__name", "service__deleted_at")
        .annotate(n=Count("id"), lost=Sum("lost_amount"))
    ]
    by_employee = [
        {
            "employee_id": r["employee_id"],
            "employee_name": r["employee__full_name"],
            "cancelled_count": r["n"],
            "lost_revenue": r["lost"] or ZERO,
        }
        for r in cancelled.values("employee_id", "employee__full_name")
        .annotate(n=Count("id"), lost=Sum("lost_amount"))
    ]
    by_service.sort(key=lambda r: (-r["lost_revenue"], r["service_name"]))
    by_employee.sort(key=lambda r: (-r["lost_revenue"], r["employee_name"]))

    return {
        "bookings_total": bookings_total,
        "cancelled_count": cancelled_count,
        "cancel_rate": round(100 * cancelled_count / bookings_total, 1) if bookings_total else 0,
        "lost_revenue": totals["lost"] or ZERO,
        "by_service": by_service,
        "by_employee": by_employee,
    }