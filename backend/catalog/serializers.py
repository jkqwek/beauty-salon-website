from django.utils import timezone
from rest_framework import serializers

from config.images import RelativeImageField
from .models import Employee, Promotion, Service, price_on


class ServiceSerializer(serializers.ModelSerializer):
    image = RelativeImageField()  # <-- URL картинки услуги
    future_bookings = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = '__all__'
        read_only_fields = ("deleted_at",)

    def get_future_bookings(self, service):
        return getattr(service, "future_bookings", None)

    def to_representation(self, service):
        data = super().to_representation(service)
        price, promo = price_on(service, timezone.localdate())
        data.update(
            price_today=str(price),
            discount_percent=promo.discount_percent if promo else 0,
            promotion=promo.name if promo else None,
        )
        return data

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Цена должна быть больше нуля.")
        return value

    def validate_duration_minutes(self, value):
        if not 5 <= value <= 480:
            raise serializers.ValidationError("Длительность должна быть от 5 до 480 минут.")
        return value


class ReviewsCountMixin(serializers.Serializer):
    reviews_count = serializers.SerializerMethodField()

    def get_reviews_count(self, employee):
        return getattr(employee, "reviews_count", 0)


class EmployeeSerializer(ReviewsCountMixin, serializers.ModelSerializer):
    photo = RelativeImageField()

    class Meta:
        model = Employee
        fields = '__all__'


class EmployeePublicSerializer(ReviewsCountMixin, serializers.ModelSerializer):
    """Для обычных пользователей: без телефона и привязанного user."""
    photo = RelativeImageField()

    class Meta:
        model = Employee
        fields = ("id", "full_name", "specialization", "photo", "services", "rating", "reviews_count")


class PromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = "__all__"

    def validate(self, attrs):
        date_from = attrs.get("date_from", getattr(self.instance, "date_from", None))
        date_to = attrs.get("date_to", getattr(self.instance, "date_to", None))
        if date_from and date_to and date_to < date_from:
            raise serializers.ValidationError({"date_to": "Дата «по» не может быть раньше даты «с»."})
        return attrs