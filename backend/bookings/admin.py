import csv
from django.contrib import admin
from django.http import HttpResponse
from .models import Schedule, Booking
from .models import BonusOperation, CancellationPolicy, Review, ReviewPhoto, SalonClosure, TimeOff

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
    search_fields = ("client__username", "employee__full_name")
    actions = [export_as_csv]


@admin.register(CancellationPolicy)
class CancellationPolicyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not CancellationPolicy.objects.exists()  # правило одно

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SalonClosure)
class SalonClosureAdmin(admin.ModelAdmin):
    list_display = ("name", "date_from", "date_to", "open_time", "close_time")


class ReviewPhotoInline(admin.TabularInline):
    model = ReviewPhoto
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("booking", "status", "created_at")
    list_filter = ("status",)
    inlines = [ReviewPhotoInline]


@admin.register(BonusOperation)
class BonusOperationAdmin(admin.ModelAdmin):
    list_display = ("client", "amount", "comment", "created_at")
    search_fields = ("client__username", "client__first_name", "client__last_name")
    raw_id_fields = ("client", "booking")
