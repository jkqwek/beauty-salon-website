from django.shortcuts import render
from rest_framework import viewsets
from .models import Service, Employee
from .serializers import ServiceSerializer, EmployeeSerializer
from .permissions import IsAdminUser

class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [IsAdminUser]

class EmployeeViewSet(viewsets.ModelViewSet):
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    permission_classes = [IsAdminUser]