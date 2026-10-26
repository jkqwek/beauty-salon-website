from django.contrib import admin
from .models import BugReport

@admin.register(BugReport)
class BugReportAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "contact", "status", "created_at")

    list_filter = ("status", "created_at")

    search_fields = ("text", "contact", "user__username")

    readonly_fields = ("created_at",)