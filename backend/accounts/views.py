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
