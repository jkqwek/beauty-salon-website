from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation

from config.images import delete_image, save_image

from bookings.models import ACTIVE_STATUSES
from .models import Promotion, Service, Employee
from .permissions import IsAdminUser
from .serializers import EmployeePublicSerializer, EmployeeSerializer, PromotionSerializer, ServiceSerializer


class PublicReadAdminWrite:
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]


class ServiceViewSet(PublicReadAdminWrite, viewsets.ModelViewSet):
    """Услуги. Удаление мягкое: услуга уходит в «Удалённые» (?deleted=1), её можно восстановить."""
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_queryset(self):
        qs = self._base_queryset()
        ordering = self.request.query_params.get("ordering")  # ?ordering=price (дешевле) или -price (дороже)
        if ordering in ("price", "-price"):
            qs = qs.order_by(ordering, "name")
        return qs

    def _base_queryset(self):
        if not self.request.user.is_staff:
            return Service.objects.filter(is_active=True)
        deleted = self.request.query_params.get("deleted") == "1" or self.action == "restore"
        return Service.all_objects.filter(deleted_at__isnull=not deleted).annotate(
            future_bookings=Count("bookings", filter=Q(
                bookings__date__gte=timezone.localdate(), bookings__status__in=ACTIVE_STATUSES,
            )),
        ).order_by("name")

    def perform_destroy(self, service):
        service.deleted_at = timezone.now()
        service.save(update_fields=["deleted_at"])

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        service = self.get_object()
        service.deleted_at = None
        service.save(update_fields=["deleted_at"])
        return Response(self.get_serializer(service).data)

    @action(detail=True, methods=["put", "delete"], parser_classes=[MultiPartParser])
    def image(self, request, pk=None):
        """Картинка услуги: PUT — загрузить (поле image), DELETE — удалить. Только сотрудники."""
        service = self.get_object()
        if request.method == "PUT":
            save_image(service, "image", request.FILES.get("image"))
        else:
            delete_image(service, "image")
        return Response(ServiceSerializer(service, context={"request": request}).data)


class EmployeeViewSet(PublicReadAdminWrite, viewsets.ModelViewSet):
    queryset = Employee.objects.prefetch_related("services")

    def get_serializer_class(self):
        return EmployeeSerializer if self.request.user.is_staff else EmployeePublicSerializer

    def get_queryset(self):
        qs = super().get_queryset().annotate(reviews_count=Count(
            "bookings__review", filter=Q(bookings__review__status="published"), distinct=True,
        ))
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        service_id = self.request.query_params.get("service")
        if service_id:
            if not service_id.isdigit():
                raise ValidationError({"service": "Должно быть числом."})
            qs = qs.filter(services__id=service_id)
        min_rating = self.request.query_params.get("min_rating")
        if min_rating:
            try:
                qs = qs.filter(rating__gte=Decimal(min_rating))
            except InvalidOperation:
                raise ValidationError({"min_rating": "Должно быть числом."})
        if self.request.query_params.get("sort") == "rating":
            qs = qs.order_by("-rating")
        return qs

    @action(detail=True, methods=["put", "delete"], parser_classes=[MultiPartParser])
    def photo(self, request, pk=None):
        """Фото карточки мастера: PUT — загрузить (поле photo), DELETE — удалить. Только сотрудники."""
        employee = self.get_object()
        if request.method == "PUT":
            save_image(employee, "photo", request.FILES.get("photo"))
        else:
            delete_image(employee, "photo")
        return Response(EmployeeSerializer(employee, context={"request": request}).data)


class PromotionViewSet(viewsets.ModelViewSet):
    """Панель: акции и скидки."""
    queryset = Promotion.objects.prefetch_related("services")
    serializer_class = PromotionSerializer
    permission_classes = [IsAdminUser]


@api_view(["GET"])
@permission_classes([AllowAny])
def public_promotions(request):
    """Блок «Акции» на главной: действующие сейчас и те, что начнутся в ближайшие 14 дней."""
    today = timezone.localdate()
    promos = Promotion.objects.filter(
        is_active=True, date_to__gte=today, date_from__lte=today + timedelta(days=14),
    ).prefetch_related("services")
    return Response([
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "discount_percent": p.discount_percent,
            "date_from": p.date_from,
            "date_to": p.date_to,
            "services": [s.name for s in p.services.all()],
            "is_current": p.date_from <= today,
        }
        for p in promos
    ])