from django.shortcuts import render
# bookings/views.py
from datetime import datetime, timedelta
from decimal import Decimal

from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import mixins, serializers, status, viewsets

from catalog.models import Employee, Service, price_on
from config.images import prepare_image
from .models import (
    ACTIVE_STATUSES, MAX_REVIEW_PHOTOS, CancellationPolicy, Review, ReviewPhoto, SalonClosure, Schedule, Booking,
    TimeOff, User,
)
from .serializers import (
    AdminBookingSerializer, AdminReviewSerializer, BookingCreateSerializer, BookingSerializer,
    CancellationPolicySerializer, PublicReviewSerializer, ReviewCreateSerializer, SalonClosureSerializer,
    ScheduleSerializer, TimeOffSerializer,
)
from .services import (
    MAX_DAYS_AHEAD, available_days, cancel_deadline_error, closure_conflicts, closures_between, conflict_label,
    get_free_slots, recalc_master_rating, reschedule,
)
from django.db.models import Avg, Count, F, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from catalog.permissions import IsAdminUser


def _int_param(params, name):
    value = params.get(name)
    if not value:
        raise ValidationError({name: "Обязательный параметр."})
    if not value.isdigit():
        raise ValidationError({name: "Должно быть числом."})
    return int(value)


def _date_param(params, name):
    value = params.get(name)
    if not value:
        raise ValidationError({name: "Обязательный параметр."})
    return serializers.DateField().run_validation(value)


def _own_booking(request):
    """?booking_id= — своя переносимая запись: её время не считается занятым, услуга берётся из неё."""
    booking_id = request.query_params.get("booking_id")
    if not booking_id:
        return None
    if not booking_id.isdigit():
        raise ValidationError({"booking_id": "Должно быть числом."})
    return get_object_or_404(Booking, pk=booking_id, client=request.user)


def _service(request, booking):
    if booking:
        return booking.service
    service_id = _int_param(request.query_params, "service_id")
    try:
        return Service.objects.get(pk=service_id, is_active=True)
    except Service.DoesNotExist:
        raise NotFound("Услуга не найдена.")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_slots(request):
    booking = _own_booking(request)
    employee_id = booking.employee_id if booking else _int_param(request.query_params, "employee_id")
    target_date = _date_param(request.query_params, "date")
    service = _service(request, booking)
    return Response({"slots": get_free_slots(employee_id, service, target_date,
                                             exclude_booking_id=booking.pk if booking else None)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_days_view(request):
    """Календарь месяца (?month=ГГГГ-ММ): дни со свободным временем и подписи праздников.
    employee_id не указан — подходит любой мастер, оказывающий услугу."""
    booking = _own_booking(request)
    service = _service(request, booking)
    try:
        first = datetime.strptime(request.query_params.get("month", ""), "%Y-%m").date()
    except ValueError:
        raise ValidationError({"month": "Месяц в формате ГГГГ-ММ."})
    last = (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

    if booking:
        employee_ids = [booking.employee_id]
    elif request.query_params.get("employee_id"):
        employee_ids = [_int_param(request.query_params, "employee_id")]
    else:
        employee_ids = list(Employee.objects.filter(is_active=True, services=service).values_list("pk", flat=True))

    today = timezone.localdate()
    date_from, date_to = max(first, today), min(last, today + timedelta(days=MAX_DAYS_AHEAD))
    days = available_days(service, employee_ids, date_from, date_to,
                          exclude_booking_id=booking.pk if booking else None) if date_from <= date_to else []

    holidays = {}
    for c in closures_between(first, last):
        day = max(c.date_from, first)
        while day <= min(c.date_to, last):
            holidays[str(day)] = c.label
            day += timedelta(days=1)
    return Response({"available": [str(d) for d in days], "holidays": holidays})


@api_view(["GET"])
@permission_classes([AllowAny])
def price_view(request):
    """Цена услуги на дату визита с учётом акций (?service_id=&date=)."""
    service = get_object_or_404(Service, pk=_int_param(request.query_params, "service_id"))
    price, promo = price_on(service, _date_param(request.query_params, "date"))
    return Response({
        "price": str(price),
        "base_price": str(service.price),
        "discount_percent": promo.discount_percent if promo else 0,
        "promotion": promo.name if promo else None,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_booking(request):
    serializer = BookingCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    booking = serializer.save()
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_history(request):
    bookings = Booking.objects.filter(client=request.user).select_related("service", "employee", "review")
    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_booking(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Запись не найдена"}, status=status.HTTP_404_NOT_FOUND)

    if booking.client != request.user:
        return Response(
            {"error": "Нельзя отменить чужую запись"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if booking.status not in ACTIVE_STATUSES:
        return Response(
            {"error": "Эту запись уже нельзя отменить (она не активна)"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deadline_error = cancel_deadline_error(booking)
    if deadline_error:
        return Response({"error": deadline_error}, status=status.HTTP_400_BAD_REQUEST)

    booking.status = "cancelled"
    booking.save()

    serializer = BookingSerializer(booking)
    return Response(serializer.data)

@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def reschedule_booking(request, booking_id):
    """Перенос клиентом: только дата и время. Те же проверки, что у новой записи (см. services.reschedule)."""
    try:
        booking = Booking.objects.select_related("service").get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Запись не найдена"}, status=status.HTTP_404_NOT_FOUND)
    if booking.client != request.user:
        return Response({"error": "Нельзя перенести чужую запись"}, status=status.HTTP_403_FORBIDDEN)

    new_date = _date_param(request.data, "date")
    new_start = serializers.TimeField(input_formats=["%H:%M"]).run_validation(request.data.get("start_time"))
    error = reschedule(booking, new_date, new_start)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    return Response(BookingSerializer(booking).data)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def popular_services_report(request):
    rows = (
        Booking.objects.exclude(status="cancelled")
        .values("service_id", "service__name", "service__deleted_at")
        .annotate(bookings_count=Count("id"))
        .annotate(revenue=F("bookings_count") * F("service__price"))
        .order_by("-bookings_count")
    )
    return Response([
        {
            "service_id": r["service_id"],
            "service_name": r["service__name"] + (" (удалена)" if r["service__deleted_at"] else ""),
            "bookings_count": r["bookings_count"],
            "revenue": str(r["revenue"]),
        }
        for r in rows
    ])

@api_view(["GET"])
@permission_classes([IsAdminUser])
def new_bookings_since(request):
    after_id = request.query_params.get("after_id")
    after_id = int(after_id) if after_id and after_id.isdigit() else 0
    new_ones = Booking.objects.filter(id__gt=after_id).exclude(status="cancelled").order_by("id")
    return Response({
        "latest_id": new_ones.last().id if new_ones.exists() else after_id,
        "count": new_ones.count(),
    })

@api_view(["GET"])
@permission_classes([IsAdminUser])
def employee_cabinet(request):
    """Кабинет мастера: график, записи с сегодняшнего дня, клиенты."""
    employee = getattr(request.user, "employee_profile", None)
    if employee is None:
        raise NotFound("Аккаунт не привязан к карточке мастера. Привяжите его в разделе «Мастера».")
    today = timezone.localdate()
    bookings = (
        employee.bookings.filter(date__gte=today)
        .exclude(status="cancelled")
        .select_related("service", "employee")
        .order_by("date", "start_time")
    )
    # filter до annotate: считаются только визиты к этому мастеру
    clients = (
        User.objects.filter(bookings__employee=employee)
        .annotate(visits=Count("bookings", filter=Q(bookings__status="completed")))
        .select_related("profile")
        .order_by("username")
    )
    return Response({
        "employee": employee.full_name,
        "employee_photo": employee.photo.url if employee.photo else None,
        "today": today,
        "schedule": [
            {"day": s.get_day_of_week_display(), "start_time": s.start_time, "end_time": s.end_time}
            for s in employee.schedules.all()
        ],
        "bookings": BookingSerializer(bookings, many=True).data,
        "clients": [
            {
                "id": u.id,
                "name": u.get_full_name() or u.username,
                "visits": u.visits,
                "phone": u.profile.phone if hasattr(u, "profile") else "",
                "note": u.profile.note if hasattr(u, "profile") else "",
                "is_regular": hasattr(u, "profile") and u.profile.is_regular,
            }
            for u in clients
        ],
    })


@api_view(["POST"])
@permission_classes([IsAdminUser])
def track_time(request, booking_id):
    """Первый вызов — фактическое начало, второй — окончание (запись становится завершённой)."""
    booking = get_object_or_404(Booking, id=booking_id, employee__user=request.user)
    if booking.status not in ACTIVE_STATUSES:
        raise ValidationError("Запись не активна.")
    if booking.date != timezone.localdate():
        raise ValidationError("Отмечать время можно только у сегодняшних записей.")

    if booking.actual_start is None:
        booking.actual_start = timezone.now()
        booking.status = "confirmed"  # клиент пришёл — запись подтверждена по факту
    else:
        booking.actual_end = timezone.now()
        booking.status = "completed"
    booking.save()
    return Response(BookingSerializer(booking).data)


class AdminBookingViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Панель: записи за период (?date_from=&date_to=, ГГГГ-ММ-ДД) и смена статуса."""
    serializer_class = AdminBookingSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = (
            Booking.objects.select_related("client__profile", "service", "employee")
            .order_by("date", "start_time")
        )
        for param, lookup in (("date_from", "date__gte"), ("date_to", "date__lte")):
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{lookup: serializers.DateField().run_validation(value)})
        return qs


class ScheduleViewSet(viewsets.ModelViewSet):
    queryset = Schedule.objects.select_related("employee")
    serializer_class = ScheduleSerializer
    permission_classes = [IsAdminUser]


class TimeOffViewSet(viewsets.ModelViewSet):
    queryset = TimeOff.objects.select_related("employee")
    serializer_class = TimeOffSerializer
    permission_classes = [IsAdminUser]


@api_view(["GET", "PATCH"])
@permission_classes([AllowAny])
def cancellation_policy(request):
    """Правило отмены: смотреть может любой (клиенту показываем срок), менять — сотрудник."""
    policy = CancellationPolicy.load()
    if request.method == "PATCH":
        if not request.user.is_staff:
            raise PermissionDenied("Менять правило отмены может только сотрудник.")
        serializer = CancellationPolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(CancellationPolicySerializer(policy).data)


def _minutes(t):
    return t.hour * 60 + t.minute


def _minutes_in_hour(intervals, hour):
    """Сколько минут интервалов (в минутах от начала суток) попадает в час [hour:00, hour+1:00)."""
    h0, h1 = hour * 60, hour * 60 + 60
    return sum(max(0, min(end, h1) - max(start, h0)) for start, end in intervals)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def salon_load(request):
    """Карта занятости мастеров по часам за день (?date=ГГГГ-ММ-ДД, по умолчанию сегодня)."""
    day = serializers.DateField().run_validation(request.query_params.get("date") or str(timezone.localdate()))
    schedules = {s.employee_id: s for s in Schedule.objects.filter(day_of_week=day.weekday())}
    bookings = list(Booking.objects.filter(date=day).exclude(status="cancelled"))
    time_offs = list(TimeOff.objects.filter(date=day))
    hours = range(
        min((s.start_time.hour for s in schedules.values()), default=9),
        max((s.end_time.hour + (s.end_time.minute > 0) for s in schedules.values()), default=21),
    )

    masters, busy_sum, available_sum = [], 0, 0
    for emp in Employee.objects.filter(is_active=True).order_by("full_name"):
        s = schedules.get(emp.id)
        work = [(_minutes(s.start_time), _minutes(s.end_time))] if s else []
        busy = [(_minutes(b.start_time), _minutes(b.end_time)) for b in bookings if b.employee_id == emp.id]
        blocked = [(_minutes(t.start_time), _minutes(t.end_time)) for t in time_offs if t.employee_id == emp.id]
        busy_total = sum(end - start for start, end in busy)
        available = max(sum(end - start for start, end in work) - sum(end - start for start, end in blocked), 0)
        busy_sum, available_sum = busy_sum + busy_total, available_sum + available
        masters.append({
            "id": emp.id,
            "name": emp.full_name,
            "load": round(100 * busy_total / available) if available else None,
            "cells": [
                {"hour": h, "work": _minutes_in_hour(work, h), "busy": _minutes_in_hour(busy, h),
                 "blocked": _minutes_in_hour(blocked, h)}
                for h in hours
            ],
        })
    return Response({
        "date": day,
        "hours": list(hours),
        "load": round(100 * busy_sum / available_sum) if available_sum else None,
        "masters": masters,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def leave_review(request, booking_id):
    """Отзыв о своём выполненном визите: один на визит, до 3 фото (поле photos). Оценка сразу идёт
    в рейтинг мастера, текст и фото публикуются после модерации."""
    booking = get_object_or_404(Booking.objects.select_related("employee"), pk=booking_id, client=request.user)
    if booking.status != "completed":
        raise ValidationError("Отзыв можно оставить только после визита.")
    if hasattr(booking, "review"):
        raise ValidationError("Отзыв на этот визит уже оставлен.")
    data = ReviewCreateSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    uploads = request.FILES.getlist("photos")
    if len(uploads) > MAX_REVIEW_PHOTOS:
        raise ValidationError({"photos": f"Не больше {MAX_REVIEW_PHOTOS} фото."})
    photos = [prepare_image(f, "photos", max_side=1600) for f in uploads]  # проверяем все до сохранения
    review = Review.objects.create(booking=booking, text=data.validated_data["text"])
    for image in photos:
        ReviewPhoto.objects.create(review=review, image=image)
    booking.rating = data.validated_data["rating"]  # то же поле, что у оценки из бота
    booking.save(update_fields=["rating"])
    recalc_master_rating(booking.employee)
    return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def public_reviews(request):
    """Опубликованные отзывы: ?employee= — о мастере, ?min_rating=&limit= — для блока на главной."""
    qs = Review.objects.filter(status="published").select_related(
        "booking__client__profile", "booking__employee", "booking__service"
    ).prefetch_related("photos")
    params = request.query_params
    if params.get("employee"):
        qs = qs.filter(booking__employee_id=_int_param(params, "employee"))
    if params.get("min_rating"):
        qs = qs.filter(booking__rating__gte=_int_param(params, "min_rating"))
    stats = qs.aggregate(average=Avg("booking__rating"), count=Count("id"))
    limit = min(_int_param(params, "limit") if params.get("limit") else 200, 200)  # ponytail: без пагинации, 200 свежих
    return Response({
        "average": round(stats["average"], 1) if stats["average"] else None,
        "count": stats["count"],
        "results": PublicReviewSerializer(qs[:limit], many=True).data,
    })


class AdminReviewViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Модерация отзывов: статус, ответ салона и удаление неуместных фото."""
    queryset = Review.objects.select_related(
        "booking__client__profile", "booking__employee", "booking__service"
    ).prefetch_related("photos")
    serializer_class = AdminReviewSerializer
    permission_classes = [IsAdminUser]

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>\d+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        photo = get_object_or_404(ReviewPhoto, pk=photo_id, review_id=pk)
        photo.image.delete(save=False)
        photo.delete()
        return Response(self.get_serializer(self.get_object()).data)


class SalonClosureViewSet(viewsets.ModelViewSet):
    """Праздники и выходные салона."""
    queryset = SalonClosure.objects.all()
    serializer_class = SalonClosureSerializer
    permission_classes = [IsAdminUser]

    @action(detail=False)
    def conflicts(self, request):
        """Предупреждение до сохранения: какие записи попадут на эти дни (?date_from=&date_to=&open_time=&close_time=)."""
        params = request.query_params
        date_from, date_to = _date_param(params, "date_from"), _date_param(params, "date_to")
        time = lambda name: serializers.TimeField().run_validation(params[name]) if params.get(name) else None
        bookings = closure_conflicts(date_from, date_to, time("open_time"), time("close_time"))
        return Response([conflict_label(b) for b in bookings])


@api_view(["GET"])
@permission_classes([AllowAny])
def upcoming_closures(request):
    """Баннер на главной: праздники и сокращённые дни в ближайшие 7 дней."""
    today = timezone.localdate()
    closures = SalonClosure.objects.filter(date_to__gte=today, date_from__lte=today + timedelta(days=7))
    return Response([
        {"name": c.name, "date_from": c.date_from, "date_to": c.date_to,
         "open_time": c.open_time, "close_time": c.close_time}
        for c in closures
    ])


@api_view(["GET"])
@permission_classes([IsAdminUser])
def panel_counters(request):
    """Счётчики панели (опрос раз в минуту): ждут подтверждения, новые отзывы, записей сегодня."""
    today = timezone.localdate()
    return Response({
        "pending_bookings": Booking.objects.filter(status="pending", date__gte=today).count(),
        "new_reviews": Review.objects.filter(status="new").count(),
        "today_bookings": Booking.objects.filter(date=today).exclude(status="cancelled").count(),
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def today_stats(request):
    """Дашборд «Сегодня»: записи по статусам и ожидаемая выручка (без отменённых)."""
    today = timezone.localdate()
    by_status = {code: 0 for code, _ in Booking.STATUS_CHOISES}
    revenue = Decimal("0.00")
    for row in Booking.objects.filter(date=today).values("status").annotate(n=Count("id"), total=Sum("price")):
        by_status[row["status"]] = row["n"]
        if row["status"] != "cancelled":
            revenue += row["total"] or 0
    return Response({
        "date": today,
        "total": sum(n for code, n in by_status.items() if code != "cancelled"),
        "by_status": by_status,
        "expected_revenue": str(revenue.quantize(Decimal("0.01"))),
    })
