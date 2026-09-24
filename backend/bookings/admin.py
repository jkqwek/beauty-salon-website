import csv
from django.contrib import admin
from django.http import HttpResponse
from .models import Schedule, Booking
from .models import TimeOff

@admin.register(TimeOff)
class TimeOffAdmin(admin.ModelAdmin):
    list_display = ("employee", "date", "start_time", "end_time", "reason")
    list_filter = ("employee", "date")


def export_as_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{modeladmin.model.__name__.lower()}s.csv"'
    writer = csv.writer(response)

    fields = [f.name for f in modeladmin.model._meta.fields]
    writer.writerow(fields)
    for obj in queryset:
        writer.writerow([getattr(obj, f) for f in fields])
    return response


export_as_csv.short_description = "Экспортировать выбранное в CSV"


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ("employee", "day_of_week", "start_time", "end_time")
    list_filter = ("employee", "day_of_week")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("client", "employee", "service", "date", "start_time", "end_time", "status")
    list_filter = ("status", "date", "employee")
    search_fields = ("client__username", "employee__fuul_name")
    actions = [export_as_csv]