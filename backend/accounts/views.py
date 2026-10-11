from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from .serializers import (ChangePasswordSerializer, PasswordResetRequestSerializer,
                          PasswordResetConfirmSerializer)
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from catalog.permissions import IsAdminUser
from config.images import delete_image, save_image
from .models import ClientProfile
from .serializers import REGULAR_CANDIDATE_DAYS, AdminUserSerializer, MeSerializer, RegisterSerializer

User = get_user_model()
COMPLETED = Q(bookings__status="completed")  # статистика клиента считается по завершённым визитам


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    """Свой профиль: GET — посмотреть, PATCH — изменить имя, фамилию, email, телефон."""
    if request.method == "GET":
        return Response(MeSerializer(request.user, context={"request": request}).data)
    serializer = MeSerializer(request.user, data=request.data, partial=True, context={"request": request})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["PUT", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser])
def me_avatar(request):
    """Свой аватар: PUT — загрузить (поле avatar), DELETE — удалить."""
    profile, _ = ClientProfile.objects.get_or_create(client=request.user)
    if request.method == "PUT":
        save_image(profile, "avatar", request.FILES.get("avatar"))
    else:
        delete_image(profile, "avatar")
    request.user.profile = profile
    return Response(MeSerializer(request.user, context={"request": request}).data)


class AdminUserViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Панель: база клиентов со статистикой визитов, смена статуса, контактов и меток."""
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        half_year_ago = timezone.localdate() - timedelta(days=REGULAR_CANDIDATE_DAYS)
        return (
            User.objects.select_related("profile", "employee_profile")
            .annotate(
                visits=Count("bookings", filter=COMPLETED),
                recent_visits=Count("bookings", filter=COMPLETED & Q(bookings__date__gte=half_year_ago)),
                last_visit=Max("bookings__date", filter=COMPLETED),
                total_spent=Sum("bookings__price", filter=COMPLETED),
            )
            .order_by("-date_joined")
        )

    def perform_update(self, serializer):
        if serializer.instance == self.request.user and serializer.validated_data.get("is_staff") is False:
            raise ValidationError({"is_staff": "Нельзя снять статус сотрудника с самого себя."})
        serializer.save()

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    s = ChangePasswordSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    if not request.user.check_password(s.validated_data["old_password"]):
        raise ValidationError({"old_password": "Неверный текущий пароль."})
    request.user.set_password(s.validated_data["new_password"])
    request.user.save()
    return Response({"detail": "Пароль изменён."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset(request):
    """Заглушка: ссылка для сброса выводится в консоль сервера."""
    s = PasswordResetRequestSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    user = User.objects.filter(email__iexact=s.validated_data["email"]).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        print(f"[PASSWORD RESET] {user.email}: uid={uid} token={token}")
    # одинаковый ответ всегда, чтобы нельзя было узнать, есть ли такой email
    return Response({"detail": "Если email существует, инструкция отправлена."})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    s = PasswordResetConfirmSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(s.validated_data["uid"])))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        raise ValidationError({"uid": "Неверная ссылка."})
    if not default_token_generator.check_token(user, s.validated_data["token"]):
        raise ValidationError({"token": "Ссылка недействительна или устарела."})
    user.set_password(s.validated_data["new_password"])
    user.save()
    return Response({"detail": "Пароль обновлён."})