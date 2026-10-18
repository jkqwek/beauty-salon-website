import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from bookings.models import ACTIVE_STATUSES
from bookings.services import bonus_balance
from config.images import RelativeImageField
from .models import ClientProfile

User = get_user_model()
REGULAR_CANDIDATE_VISITS = 5  # подсказка ⭐: столько завершённых визитов…
REGULAR_CANDIDATE_DAYS = 183  # …за последние полгода


def normalize_phone(value):
    """Российский номер в виде +79001234567. Подходят 8 900 123-45-67, +7 (900) 123 45 67, 9001234567;
    не похоже на номер — None."""
    if not re.fullmatch(r"\+?[\d\s()-]+", value):
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits[0] in "78":
        digits = digits[1:]
    return f"+7{digits}" if len(digits) == 10 else None


class PhoneField(serializers.CharField):
    """Телефон из профиля: необязательный, хранится в виде +79001234567."""

    def __init__(self, **kwargs):
        super().__init__(source="profile.phone", required=False, allow_blank=True, max_length=20, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not value:
            return ""
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError("Введите номер в формате +7 900 123-45-67.")
        return phone


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()  # обязательный (у модели User он необязательный)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ("username", "email", "password", "password2")

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Пароли не совпадают"})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        return user

class AdminUserSerializer(serializers.ModelSerializer):
    """Клиент в панели: статус (is_staff = сотрудник), контакты, метки салона и статистика визитов."""
    phone = PhoneField()
    note = serializers.CharField(source="profile.note", required=False, allow_blank=True, max_length=1000)
    is_regular = serializers.BooleanField(source="profile.is_regular", required=False)
    is_blocked = serializers.BooleanField(source="profile.is_blocked", required=False)
    blocked_reason = serializers.CharField(
        source="profile.blocked_reason", required=False, allow_blank=True, max_length=200
    )
    blocked_at = serializers.DateTimeField(source="profile.blocked_at", read_only=True)
    avatar = RelativeImageField(source="profile.avatar")
    master = serializers.CharField(source="employee_profile.full_name", read_only=True)
    # аннотации из AdminUserViewSet.get_queryset, считаются по завершённым записям
    visits = serializers.IntegerField(read_only=True)
    last_visit = serializers.DateField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    bonus_balance = serializers.IntegerField(read_only=True)
    is_candidate = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "phone", "avatar", "is_staff",
                  "date_joined", "note", "is_regular", "is_candidate", "is_blocked", "blocked_reason",
                  "blocked_at", "master", "visits", "last_visit", "total_spent", "bonus_balance")
        read_only_fields = ("username", "date_joined")

    def get_is_candidate(self, user):
        """Подсказка ⭐: часто ходит, но ещё не отмечен постоянным."""
        regular = hasattr(user, "profile") and user.profile.is_regular
        return not regular and getattr(user, "recent_visits", 0) >= REGULAR_CANDIDATE_VISITS

    def validate(self, attrs):
        user = self.instance
        is_staff = attrs.get("is_staff", user.is_staff)
        was_blocked = hasattr(user, "profile") and user.profile.is_blocked
        if is_staff and attrs.get("profile", {}).get("is_blocked", was_blocked):
            raise serializers.ValidationError({"is_blocked": "Сотрудника заблокировать нельзя."})
        return attrs

    def update(self, user, data):
        profile = data.pop("profile", None)
        if profile is not None:
            if "is_blocked" in profile:
                was_blocked = hasattr(user, "profile") and user.profile.is_blocked
                if profile["is_blocked"] and not was_blocked:
                    profile["blocked_at"] = timezone.now()
                elif not profile["is_blocked"]:
                    profile.update(blocked_at=None, blocked_reason="")
            user.profile, _ = ClientProfile.objects.update_or_create(client=user, defaults=profile)
        if "is_staff" in data:
            data["is_superuser"] = data["is_staff"]  # сотрудник = полные права
        return super().update(user, data)


class MeSerializer(serializers.ModelSerializer):
    """Свой профиль в личном кабинете. Аватар загружается отдельным запросом."""
    email = serializers.EmailField()
    phone = PhoneField()
    avatar = RelativeImageField(source="profile.avatar")
    is_blocked = serializers.BooleanField(source="profile.is_blocked", read_only=True)
    bonus_balance = serializers.SerializerMethodField()
    next_booking = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "phone", "avatar", "is_staff", "is_blocked",
                  "bonus_balance", "next_booking")
        read_only_fields = ("username", "is_staff")

    def get_bonus_balance(self, user):
        return bonus_balance(user)

    def get_next_booking(self, user):
        """Ближайшая предстоящая запись — для напоминания в шапке сайта и в кабинете."""
        now = timezone.localtime()
        b = (
            user.bookings.filter(status__in=ACTIVE_STATUSES)
            .filter(Q(date__gt=now.date()) | Q(date=now.date(), start_time__gt=now.time()))
            .select_related("service", "employee")
            .order_by("date", "start_time")
            .first()
        )
        if b is None:
            return None
        return {"id": b.id, "date": b.date, "start_time": b.start_time,
                "service_name": b.service.name, "employee_name": b.employee.full_name}

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Этот email уже занят.")
        return value

    def update(self, user, data):
        profile = data.pop("profile", None)
        if profile is not None:
            user.profile, _ = ClientProfile.objects.update_or_create(client=user, defaults=profile)
        return super().update(user, data)

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, validators=[validate_password])