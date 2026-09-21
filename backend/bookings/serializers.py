from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import serializers

from catalog.models import Employee, Service
from .models import Booking
from .services import MAX_DAYS_AHEAD, get_free_slots


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ("client", "end_time", "status", "created_at")


class BookingCreateSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(is_active=True))
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    date = serializers.DateField()
    start_time = serializers.TimeField(input_formats=["%H:%M"])

    def validate_date(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError("Нельзя записаться на прошедшую дату.")
        if value > today + timedelta(days=MAX_DAYS_AHEAD):
            raise serializers.ValidationError(
                f"Запись доступна не более чем на {MAX_DAYS_AHEAD} дней вперёд."
            )
        return value

    def validate(self, attrs):
        employee, service = attrs["employee"], attrs["service"]

        if not employee.services.filter(pk=service.pk).exists():
            raise serializers.ValidationError({"service": "Этот мастер не оказывает выбранную услугу."})

        slot = attrs["start_time"].strftime("%H:%M")
        if slot not in get_free_slots(employee.pk, service, attrs["date"]):
            raise serializers.ValidationError({"start_time": "Это время недоступно. Выберите другое."})
        return attrs

    def create(self, validated_data):
        service = validated_data["service"]
        start = datetime.combine(validated_data["date"], validated_data["start_time"])
        return Booking.objects.create(
            client=self.context["request"].user,
            employee=validated_data["employee"],
            service=service,
            date=validated_data["date"],
            start_time=validated_data["start_time"],
            end_time=(start + timedelta(minutes=service.duration_minutes)).time(),
            status="active",
        )