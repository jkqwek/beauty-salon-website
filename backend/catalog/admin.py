from django.contrib import admin
from .models import Service, Employee


def duplicate_services(modeladmin, request, queryset):
    for service in queryset:
        service.pk = None
        service.id = None
        service.name = f"{service.name} (копия)"
        service.save()

duplicate_services.short_description = "Копировать выбранные услуги"


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "duration_minutes", "is_active")
    list_filter = ("category", "is_active")
    actions = [duplicate_services]


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "is_active")
    filter_horizontal = ("services",)