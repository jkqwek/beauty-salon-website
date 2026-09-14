from django.shortcuts import render
# bookings/views.py
from datetime import datetime, timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from catalog.models import Service
from .models import Schedule, Booking
from .serializers import BookingSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_slots(request):
    employee_id = request.query_params.get("employee_id")
    service_id = request.query_params.get("service_id")
    date_str = request.query_params.get("date")

    if not all([employee_id, service_id, date_str]):
        return Response(
            {"error": "Нужно передать employee_id, service_id и date"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return Response(
            {"error": "Дата должна быть в формате YYYY-MM-DD"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        service = Service.objects.get(id=service_id)
    except Service.DoesNotExist:
        return Response({"error": "Услуга не найдена"}, status=status.HTTP_404_NOT_FOUND)

    # 1) график сотрудника на этот день недели
    weekday = target_date.weekday()  # 0 = Понедельник ... 6 = Воскресенье
    schedule = Schedule.objects.filter(employee_id=employee_id, day_of_week=weekday).first()

    if not schedule:
        return Response({"slots": []})  # выходной — свободных слотов нет

    # 2) длительность услуги
    duration = timedelta(minutes=service.duration_minutes)
    step = timedelta(minutes=15)  # шаг сетки слотов

    # 3) разбиваем рабочий день на слоты нужной длины
    current = datetime.combine(target_date, schedule.start_time)
    work_end = datetime.combine(target_date, schedule.end_time)

    candidate_slots = []
    while current + duration <= work_end:
        candidate_slots.append(current)
        current += step

    # 4) убираем слоты, пересекающиеся с уже существующими активными записями
    existing_bookings = Booking.objects.filter(
        employee_id=employee_id, date=target_date, status="active"
    )

    free_slots = []
    for slot_start in candidate_slots:
        slot_end = slot_start + duration
        overlaps = False
        for booking in existing_bookings:
            booking_start = datetime.combine(target_date, booking.start_time)
            booking_end = datetime.combine(target_date, booking.end_time)
            if slot_start < booking_end and booking_start < slot_end:
                overlaps = True
                break
        if not overlaps:
            free_slots.append(slot_start.strftime("%H:%M"))

    return Response({"slots": free_slots})

@api_view
@permission_classes([IsAuthenticated])
def create_booking(request):
    employee_id = request.query_params.get("employee_id")
    service_id = request.query_params.get("service_id")
    date_str = request.query_params.get("date")
    start_time_str = request.query_params.get("start_time")
    
    if not all([employee_id, service_id, date_str, start_time_str]):
        return Response(
            {"error": "Нужно передать employee_id, service_id, date, start_time"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        start_time = datetime.strptime(start_time_str, "%H:%M").time()
    except ValueError:
        return Response(
            {"error": "Дата или время должны быть в формате YYYY-MM-DD HH:MM"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    
    try:
        service = Service.objects.get(id=service_id)
    except Service.DoesNotExist:
        return Response({"error": "Услуга не найдена"}, status=status.HTTP_404_NOT_FOUND)

    start_dt = datetime.combine(target_date, start_time)
    end_dt = start_dt + timedelta(minutes=service.duration_minutes)
    end_time = end_dt.time()
    existing_bookings = Booking.objects.filter(
        employee_id=employee_id,
        date=target_date,
        status="active"
    )
        

    for booking in existing_bookings:
        booking_start = datetime.combine(target_date, booking.start_time)
        booking_end = datetime.combine(target_date, booking.end_time)
        if start_dt < booking_end and booking_start < end_dt:
            return Response({"error": "Выбранный слот занят"}, status=status.HTTP_400_BAD_REQUEST)
    
    booking = Booking.objects.create(
        client=request.user,
        employee_id=employee_id,
        service=service,
        date=target_date,
        start_time=start_time,
        end_time=end_time,
        status="active",
    )
    
    serializer = BookingSerializer(booking)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_history(request):
    bookings = Booking.objects.filter(client=request.user)
    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)