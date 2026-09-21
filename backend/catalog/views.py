from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny

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
        return qs