from django.contrib.auth import get_user_model
from django.db.models import Count, Max, Q, Sum
from rest_framework import generics, mixins, permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from catalog.permissions import IsAdminUser
from .serializers import AdminUserSerializer, RegisterSerializer

User = get_user_model()
COMPLETED = Q(bookings__status="completed")  # статистика клиента считается по завершённым визитам


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    u = request.user
    return Response(
        {"id": u.id, "username": u.username, "email": u.email,
         "first_name": u.first_name, "is_staff": u.is_staff}
    )


class AdminUserViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """Панель: база клиентов со статистикой визитов, смена статуса, телефона и комментария."""
    queryset = (
        User.objects.select_related("profile", "employee_profile")
        .annotate(
            visits=Count("bookings", filter=COMPLETED),
            last_visit=Max("bookings__date", filter=COMPLETED),
            total_spent=Sum("bookings__price", filter=COMPLETED),
        )
        .order_by("-date_joined")
    )
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

    def perform_update(self, serializer):
        if serializer.instance == self.request.user and serializer.validated_data.get("is_staff") is False:
            raise ValidationError({"is_staff": "Нельзя снять статус сотрудника с самого себя."})
        serializer.save()
