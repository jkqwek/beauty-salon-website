from rest_framework import serializers
from .models import Service, Employee


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = '__all__'

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Цена должна быть больше нуля.")
        return value

    def validate_duration_minutes(self, value):
        if not 5 <= value <= 480:
            raise serializers.ValidationError("Длительность должна быть от 5 до 480 минут.")
        return value


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = '__all__'


class EmployeePublicSerializer(serializers.ModelSerializer):
    """Для обычных пользователей: без телефона и привязанного user."""
    class Meta:
        model = Employee
        fields = ("id", "full_name", "specialization", "photo", "services")