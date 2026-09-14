from django.contrib import admin
from .models import Schedule, Booking

@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("employee", "day_of_week", "start_time", "end_time")
    list_filter = ("employee", "day_of_week")

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("client", "employee", "service", "date", "start_time", "end_time", "status")
    list_filter = ("status", "date", "employee")
    search_fields = ("client__username", "employee__fuul_name")