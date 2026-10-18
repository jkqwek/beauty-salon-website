from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework import serializers

from catalog.models import Employee, Service, price_on
from config.images import RelativeImageField
from .models import BonusOperation, Booking, CancellationPolicy, Review, SalonClosure, Schedule, TimeOff
from .services import MAX_DAYS_AHEAD, closure_conflicts, conflict_label, get_free_slots, slot_taken

BLOCKED_MESSAGE = "Онлайн-запись недоступна. Свяжитесь с салоном."


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    review_status = serializers.CharField(source="review.status", read_only=True)  # null — отзыва нет

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
        profile = getattr(self.context["request"].user, "profile", None)
        if profile and profile.is_blocked:  # чёрный список: без объяснений, нейтральный текст
            raise serializers.ValidationError(BLOCKED_MESSAGE)

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
            status="pending",  # ждёт подтверждения салоном, но время уже занято
            price=price_on(service, validated_data["date"])[0],  # со скидкой по дате визита
        )

class AdminBookingSerializer(BookingSerializer):
    """Запись в панели: видно клиента и его метки, менять можно только статус."""
    client_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    client_is_regular = serializers.BooleanField(source="client.profile.is_regular", read_only=True)
    client_is_blocked = serializers.BooleanField(source="client.profile.is_blocked", read_only=True)

    class Meta(BookingSerializer.Meta):
        read_only_fields = [f.name for f in Booking._meta.fields if f.name != "status"]

    def get_client_name(self, b):
        return b.client.get_full_name() or b.client.username

    def get_service_name(self, b):
        return b.service.name + (" (удалена)" if b.service.deleted_at else "")

    def validate_status(self, value):
        b = self.instance
        if b and b.status == "cancelled" and value != "cancelled" and slot_taken(
            b.employee_id, b.date, b.start_time, b.end_time, exclude_id=b.pk
        ):
            raise serializers.ValidationError("Это время уже занято другой записью.")
        return value


class TimeRangeSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        start, end = attrs.get("start_time"), attrs.get("end_time")
        if start and end and start >= end:
            raise serializers.ValidationError({"end_time": "Конец должен быть позже начала."})
        return attrs


class ScheduleSerializer(TimeRangeSerializer):
    class Meta:
        model = Schedule
        fields = "__all__"


class TimeOffSerializer(TimeRangeSerializer):
    class Meta:
        model = TimeOff
        fields = "__all__"


class CancellationPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = CancellationPolicy
        fields = ("deadline_hours",)


class SalonClosureSerializer(serializers.ModelSerializer):
    """Праздник/выходной салона + записи, которые на него попадают (решает сотрудник)."""
    conflicts = serializers.SerializerMethodField()

    class Meta:
        model = SalonClosure
        fields = ("id", "name", "date_from", "date_to", "open_time", "close_time", "conflicts")

    def get_conflicts(self, c):
        return [conflict_label(b) for b in closure_conflicts(c.date_from, c.date_to, c.open_time, c.close_time)]

    def validate(self, attrs):
        get = lambda key: attrs.get(key, getattr(self.instance, key, None))
        if get("date_to") < get("date_from"):
            raise serializers.ValidationError({"date_to": "Дата «по» не может быть раньше даты «с»."})
        opens, closes = get("open_time"), get("close_time")
        if bool(opens) != bool(closes):
            raise serializers.ValidationError(
                {"close_time": "Укажите оба времени для сокращённого дня или оставьте оба пустыми — салон закрыт."}
            )
        if opens and opens >= closes:
            raise serializers.ValidationError({"close_time": "Время закрытия должно быть позже открытия."})
        return attrs


class ReviewCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(min_length=10, max_length=1000)


def public_author(user):
    """«Анна С.» — без логина и контактов; без имени — «Клиент салона»."""
    if not user.first_name:
        return "Клиент салона"
    return f"{user.first_name} {user.last_name[0]}." if user.last_name else user.first_name


class PublicReviewSerializer(serializers.ModelSerializer):
    rating = serializers.IntegerField(source="booking.rating", read_only=True)
    author = serializers.SerializerMethodField()
    author_avatar = RelativeImageField(source="booking.client.profile.avatar")
    employee_id = serializers.IntegerField(source="booking.employee_id", read_only=True)
    employee_name = serializers.CharField(source="booking.employee.full_name", read_only=True)
    service_name = serializers.CharField(source="booking.service.name", read_only=True)
    photos = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ("id", "rating", "text", "reply", "created_at", "author", "author_avatar",
                  "employee_id", "employee_name", "service_name", "photos")

    def get_author(self, review):
        return public_author(review.booking.client)

    def get_photos(self, review):
        return [{"id": p.id, "url": p.image.url} for p in review.photos.all()]


class AdminReviewSerializer(PublicReviewSerializer):
    """Модерация: меняются только статус и ответ салона."""
    client_name = serializers.SerializerMethodField()
    visit_date = serializers.DateField(source="booking.date", read_only=True)

    class Meta(PublicReviewSerializer.Meta):
        fields = PublicReviewSerializer.Meta.fields + ("status", "client_name", "visit_date")
        read_only_fields = ("text", "created_at")

    def get_client_name(self, review):
        user = review.booking.client
        return user.get_full_name() or user.username


class BonusOperationSerializer(serializers.ModelSerializer):
    """Операция с баллами. Вручную сотрудник задаёт сумму (+ начислить, − списать) и комментарий."""
    amount = serializers.IntegerField(min_value=-100000, max_value=100000)
    comment = serializers.CharField(max_length=200)
    visit_date = serializers.DateField(source="booking.date", read_only=True)  # у начислений за визит

    class Meta:
        model = BonusOperation
        fields = ("id", "amount", "comment", "visit_date", "created_at")

    def validate_amount(self, value):
        if value == 0:
            raise serializers.ValidationError("Укажите количество баллов.")
        return value
