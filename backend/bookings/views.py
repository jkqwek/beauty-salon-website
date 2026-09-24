from django.shortcuts import render
# bookings/views.py
from datetime import datetime, timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from catalog.models import Service
from .models import Schedule, Booking
from .serializers import BookingCreateSerializer, BookingSerializer
from .services import get_free_slots
from django.db.models import Count, F
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