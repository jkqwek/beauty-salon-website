from django.contrib import admin
from .models import Service, Employee

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "duration_minutes", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name",)

@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "phone", "is_active")
    list_filter = ("specialization", "is_active")
    search_fields = ("full_name", "phone")