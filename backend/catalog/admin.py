from django.contrib import admin
from .models import Employee, Promotion, Service


def duplicate_services(modeladmin, request, queryset):
    for service in queryset:
        service.pk = None
        service.id = None
        service.name = f"{service.name} (копия)"
        service.save()

duplicate_services.short_description = "Копировать выбранные услуги"


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "duration_minutes", "is_active", "deleted_at")
    list_filter = ("category", "is_active")
    actions = [duplicate_services]

    def get_queryset(self, request):
        return Service.all_objects.all()  # в Django-админке видны и удалённые


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("full_name", "specialization", "is_active")
    filter_horizontal = ("services",)


@admin.register(Promotion)
class PromotionAdmin(admin.ModelAdmin):
    list_display = ("name", "discount_percent", "date_from", "date_to", "is_active")
    filter_horizontal = ("services",)
