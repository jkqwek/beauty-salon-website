from django.shortcuts import render
# bookings/views.py
from datetime import datetime, timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import mixins, serializers, status, viewsets

from catalog.models import Employee, Service
from .models import CancellationPolicy, Schedule, Booking, TimeOff, User
from .serializers import (
    AdminBookingSerializer, BookingCreateSerializer, BookingSerializer, CancellationPolicySerializer,
    ScheduleSerializer, TimeOffSerializer,
)
from .services import cancel_deadline_error, get_free_slots
from django.db.models import Count, F, Q
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_slots(request):
    employee_id = _int_param(request.query_params, "employee_id")
    service_id = _int_param(request.query_params, "service_id")

    date_str = request.query_params.get("date")
    if not date_str:
        raise ValidationError({"date": "Обязательный параметр."})
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({"date": "Дата должна быть в формате ГГГГ-ММ-ДД."})

    try:
        service = Service.objects.get(pk=service_id, is_active=True)
    except Service.DoesNotExist:
        raise NotFound("Услуга не найдена.")

    return Response({"slots": get_free_slots(employee_id, service, target_date)})


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
    bookings = Booking.objects.filter(client=request.user).select_related("service", "employee")
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

    if booking.status != "active":
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
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({"error": "Запись не найдена"}, status=status.HTTP_404_NOT_FOUND)

    if booking.client != request.user:
        return Response(
            {"error": "Нельзя перенести чужую запись"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if booking.status != "active":
        return Response(
            {"error": "Эту запись уже нельзя перенести (она не активна)"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    deadline_error = cancel_deadline_error(booking)
    if deadline_error:
        return Response({"error": deadline_error}, status=status.HTTP_400_BAD_REQUEST)

    new_date_str = request.data.get("date")
    new_start_time_str = request.data.get("start_time")

    if not all([new_date_str, new_start_time_str]):
        return Response(
            {"error": "Нужно передать date и start_time"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        new_date = datetime.strptime(new_date_str, "%Y-%m-%d").date()
        new_start_time = datetime.strptime(new_start_time_str, "%H:%M").time()
    except ValueError:
        return Response(
            {"error": "Неверный формат даты или времени"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # пересчитываем время окончания по длительности услуги
    new_start_dt = datetime.combine(new_date, new_start_time)
    new_end_dt = new_start_dt + timedelta(minutes=booking.service.duration_minutes)
    new_end_time = new_end_dt.time()

    # повторная проверка занятости — исключаем саму эту запись, иначе конфликт сама с собой
    existing_bookings = Booking.objects.filter(
        employee=booking.employee, date=new_date, status="active"
    ).exclude(id=booking.id)

    for other in existing_bookings:
        other_start = datetime.combine(new_date, other.start_time)
        other_end = datetime.combine(new_date, other.end_time)
        if new_start_dt < other_end and other_start < new_end_dt:
            return Response(
                {"error": "Это время уже занято, выберите другой слот"},
                status=status.HTTP_409_CONFLICT,
            )

    booking.date = new_date
    booking.start_time = new_start_time
    booking.end_time = new_end_time
    booking.save()

    serializer = BookingSerializer(booking)
    return Response(serializer.data)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def popular_services_report(request):
    rows = (
        Booking.objects.filter(status__in=["active", "completed"])
        .values("service_id", "service__name")
        .annotate(bookings_count=Count("id"))
        .annotate(revenue=F("bookings_count") * F("service__price"))
        .order_by("-bookings_count")
    )
    return Response([
        {
            "service_id": r["service_id"],
            "service_name": r["service__name"],
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
    new_ones = Booking.objects.filter(id__gt=after_id, status="active").order_by("id")
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
            }
            for u in clients
        ],
    })


@api_view(["POST"])
@permission_classes([IsAdminUser])
def track_time(request, booking_id):
    """Первый вызов — фактическое начало, второй — окончание (запись становится завершённой)."""
    booking = get_object_or_404(Booking, id=booking_id, employee__user=request.user)
    if booking.status != "active":
        raise ValidationError("Запись не активна.")
    if booking.date != timezone.localdate():
        raise ValidationError("Отмечать время можно только у сегодняшних записей.")

    if booking.actual_start is None:
        booking.actual_start = timezone.now()
    else:
        booking.actual_end = timezone.now()
        booking.status = "completed"
    booking.save()
    return Response(BookingSerializer(booking).data)


class AdminBookingViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Панель: записи за день (?date=ГГГГ-ММ-ДД) и смена статуса."""
    serializer_class = AdminBookingSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Booking.objects.select_related("client", "service", "employee").order_by("date", "start_time")
        day = self.request.query_params.get("date")
        if day:
            qs = qs.filter(date=serializers.DateField().run_validation(day))
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
    bookings = list(Booking.objects.filter(date=day, status__in=["active", "completed"]))
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
