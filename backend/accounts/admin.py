from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin
from bookings.admin import export_as_csv

User = get_user_model()


class CustomUserAdmin(UserAdmin):
    actions = list(UserAdmin.actions or []) + [export_as_csv]


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)