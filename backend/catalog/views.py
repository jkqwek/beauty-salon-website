from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from decimal import Decimal, InvalidOperation

from config.images import delete_image, save_image

from .models import Service, Employee
from .permissions import IsAdminUser
from .serializers import ServiceSerializer, EmployeeSerializer, EmployeePublicSerializer


class PublicReadAdminWrite:
    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]


class ServiceViewSet(PublicReadAdminWrite, viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        return qs if self.request.user.is_staff else qs.filter(is_active=True)


class EmployeeViewSet(PublicReadAdminWrite, viewsets.ModelViewSet):
    queryset = Employee.objects.prefetch_related("services")

    def get_serializer_class(self):
        return EmployeeSerializer if self.request.user.is_staff else EmployeePublicSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True)
        service_id = self.request.query_params.get("service")  # /api/employees/?service=3
        if service_id:
            if not service_id.isdigit():
                raise ValidationError({"service": "Должно быть числом."})
            qs = qs.filter(services__id=service_id)
        min_rating = self.request.query_params.get("min_rating")  # ?min_rating=4.5
        if min_rating:
            try:
                qs = qs.filter(rating__gte=Decimal(min_rating))
            except InvalidOperation:
                raise ValidationError({"min_rating": "Должно быть числом."})
        if self.request.query_params.get("sort") == "rating":  # ?sort=rating
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