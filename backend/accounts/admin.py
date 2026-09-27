from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from bookings.admin import export_as_csv
from catalog.models import Employee
from .models import ClientProfile

User = get_user_model()


class ClientProfileInline(admin.StackedInline):
    model = ClientProfile
    can_delete = False


class EmployeeInline(admin.StackedInline):
    """Привязка аккаунта к карточке мастера — даёт ему "Мой кабинет" на сайте."""
    model = Employee
    can_delete = False  # удаление мастера каскадом удалит все его записи
    filter_horizontal = ("services",)
    verbose_name = "Карточка мастера"  # у OneToOne-инлайна заголовок берётся из verbose_name


class CustomUserAdmin(UserAdmin):
    actions = list(UserAdmin.actions or []) + [export_as_csv]
    inlines = [EmployeeInline, ClientProfileInline]

    def save_model(self, request, obj, form, change):
        obj.is_superuser = obj.is_staff  # два статуса: покупатель или сотрудник с полными правами
        super().save_model(request, obj, form, change)


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
