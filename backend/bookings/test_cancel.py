"""Сценарий отмены записи клиентом (задача 134)."""
from datetime import time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from catalog.models import Employee, Service
from .models import Booking, CancellationPolicy, Schedule

User = get_user_model()


class CancelBookingTests(APITestCase):
    def setUp(self):
        for name in ("notify_admin_new_appointment", "notify_master_new_booking"):  # без отправки в Telegram
            patcher = patch(f"bookings.signals.{name}")
            patcher.start()
            self.addCleanup(patcher.stop)
        self.master = Employee.objects.create(full_name="Мастер", specialization="—")
        self.service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60)
        self.master.services.add(self.service)
        self.anna = User.objects.create_user("anna", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        self.today = timezone.localdate()
        self.day = self.today + timedelta(days=3)
        Schedule.objects.create(employee=self.master, day_of_week=self.day.weekday(),
                                start_time=time(10), end_time=time(12))
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 24})
        self.client.force_authenticate(self.anna)

    def booking(self, client=None, status="confirmed", day=None, at=10):
        return Booking.objects.create(
            client=client or self.anna, employee=self.master, service=self.service, price=1000,
            date=day or self.day, start_time=time(at), end_time=time(at + 1), status=status,
        )

    def cancel(self, booking_id):
        return self.client.post(f"/api/bookings/{booking_id}/cancel/")

    def slots(self):
        r = self.client.get("/api/bookings/available-slots/", {
            "employee_id": self.master.id, "service_id": self.service.id, "date": str(self.day)})
        return r.json()["slots"]

    def test_client_cancels_own_booking(self):
        for status in ("pending", "confirmed"):
            with self.subTest(status=status):
                b = self.booking(status=status)
                r = self.cancel(b.id)
                self.assertEqual(r.status_code, 200)
                self.assertEqual(r.json()["status"], "cancelled")
                b.refresh_from_db()
                self.assertEqual(b.status, "cancelled")
                b.delete()

    def test_time_is_freed_after_cancel(self):
        r = self.client.post("/api/bookings/", {
            "employee": self.master.id, "service": self.service.id, "date": str(self.day), "start_time": "10:00"})
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("10:00", self.slots())

        self.assertEqual(self.cancel(r.json()["id"]).status_code, 200)
        self.assertIn("10:00", self.slots())

        self.client.force_authenticate(self.bob)  # освободившееся время может занять другой клиент
        r = self.client.post("/api/bookings/", {
            "employee": self.master.id, "service": self.service.id, "date": str(self.day), "start_time": "10:00"})
        self.assertEqual(r.status_code, 201)

    def test_cannot_cancel_someone_elses_booking(self):
        b = self.booking(client=self.bob)
        self.assertEqual(self.cancel(b.id).status_code, 403)
        b.refresh_from_db()
        self.assertEqual(b.status, "confirmed")

    def test_unknown_booking(self):
        self.assertEqual(self.cancel(999999).status_code, 404)

    def test_requires_login(self):
        b = self.booking()
        self.client.force_authenticate(None)
        self.assertEqual(self.cancel(b.id).status_code, 401)
        b.refresh_from_db()
        self.assertEqual(b.status, "confirmed")

    def test_inactive_booking_cannot_be_cancelled(self):
        for status in ("cancelled", "completed"):
            with self.subTest(status=status):
                b = self.booking(status=status)
                r = self.cancel(b.id)
                self.assertEqual(r.status_code, 400)
                self.assertIn("error", r.json())
                b.refresh_from_db()
                self.assertEqual(b.status, status)
                b.delete()

    def test_second_cancel_is_rejected(self):
        b = self.booking()
        self.assertEqual(self.cancel(b.id).status_code, 200)
        self.assertEqual(self.cancel(b.id).status_code, 400)

    def test_other_bookings_are_not_touched(self):
        mine, second, bobs = self.booking(at=10), self.booking(at=11), self.booking(client=self.bob, at=11)
        self.cancel(mine.id)
        second.refresh_from_db()
        bobs.refresh_from_db()
        self.assertEqual((second.status, bobs.status), ("confirmed", "confirmed"))

    def test_cancellation_deadline(self):
        soon = self.booking(day=self.today + timedelta(days=2))  # до начала примерно 34–58 часов
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 72})
        r = self.cancel(soon.id)
        self.assertEqual(r.status_code, 400)
        self.assertIn("72 ч", r.json()["error"])
        soon.refresh_from_db()
        self.assertEqual(soon.status, "confirmed")

        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 24})
        self.assertEqual(self.cancel(soon.id).status_code, 200)

    def test_cancelled_booking_stays_in_history(self):
        b = self.booking()
        self.cancel(b.id)
        history = self.client.get("/api/bookings/my/").json()
        self.assertEqual([(x["id"], x["status"]) for x in history], [(b.id, "cancelled")])
