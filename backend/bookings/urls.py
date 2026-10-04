from django.urls import path
from .views import (
    available_slots,
    create_booking,
    booking_history,
    cancel_booking,
    reschedule_booking,
    popular_services_report,
    new_bookings_since,
    employee_cabinet,
    track_time,
    cancellation_policy,
)

urlpatterns = [
    path('available-slots/', available_slots, name='available-slots'),
    path('', create_booking, name='create-booking'),
    path('my/', booking_history, name='booking-history'),
    path("<int:booking_id>/cancel/", cancel_booking, name="cancel-booking"),
    path("<int:booking_id>/reschedule/", reschedule_booking, name="reschedule-booking"),
    path("reports/popular-services/", popular_services_report, name="popular-services-report"),
    path("new-since/", new_bookings_since, name="new-bookings-since"),
    path("employee/", employee_cabinet, name="employee-cabinet"),
    path("<int:booking_id>/track-time/", track_time, name="track-time"),
    path("cancellation-policy/", cancellation_policy, name="cancellation-policy"),
]