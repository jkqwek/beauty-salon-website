from django.urls import path
from .views import available_slots, create_booking, booking_history, cancel_booking, reschedule_booking

urlpatterns = [
    path('available-slots/', available_slots, name='available-slots'),
    path('', create_booking, name='create-booking'),
    path('my/', booking_history, name='booking-history'),
    path("<int:booking_id>/reschedule/", reschedule_booking, name="reschedule-booking"),
]