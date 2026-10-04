from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import ClientProfile

User = get_user_model()


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
    """Клиент в панели: статус (is_staff = сотрудник), телефон, комментарий и статистика визитов."""
    phone = serializers.CharField(source="profile.phone", required=False, allow_blank=True, max_length=20)
    note = serializers.CharField(source="profile.note", required=False, allow_blank=True, max_length=1000)
    master = serializers.CharField(source="employee_profile.full_name", read_only=True)
    # аннотации из AdminUserViewSet.queryset, считаются по завершённым записям
    visits = serializers.IntegerField(read_only=True)
    last_visit = serializers.DateField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "email", "phone", "is_staff", "date_joined",
                  "note", "master", "visits", "last_visit", "total_spent")
        read_only_fields = ("username", "date_joined")

    def update(self, user, data):
        profile = data.pop("profile", None)
        if profile is not None:
            user.profile, _ = ClientProfile.objects.update_or_create(client=user, defaults=profile)
        if "is_staff" in data:
            data["is_superuser"] = data["is_staff"]  # сотрудник = полные права
        return super().update(user, data)
