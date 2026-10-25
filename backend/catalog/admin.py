from django.contrib import admin
from .models import Employee, Promotion, Service, ServiceSuggestion


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

@admin.register(ServiceSuggestion)
class ServiceSuggestionAdmin(admin.ModelAdmin):
    list_display = ("title", "contact", "name", "created_at", "is_processed")
    list_filter = ("is_processed",)
    list_editable = ("is_processed",)
    search_fields = ("title", "contact", "name", "description")
    readonly_fields = ("created_at",)
    actions = ["mark_processed"]

    @admin.action(description="Отметить выбранные как обработанные")
    def mark_processed(self, request, queryset):
        updated = queryset.update(is_processed=True)
        self.message_user(request, f"Отмечено обработанными: {updated}")