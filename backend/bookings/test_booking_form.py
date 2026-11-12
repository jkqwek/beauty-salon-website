"""Проверка формы записи на валидацию (задача 131)."""
from datetime import time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ClientProfile
from catalog.models import Employee, Service
from .models import Booking, CancellationPolicy, PromoCode, Schedule
from .serializers import BLOCKED_MESSAGE
from .services import MAX_DAYS_AHEAD

User = get_user_model()
URL = "/api/bookings/"


class BookingFormTests(APITestCase):
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
        self.day = self.today + timedelta(days=1)
        Schedule.objects.create(employee=self.master, day_of_week=self.day.weekday(),
                                start_time=time(10), end_time=time(12))
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 0})
        self.client.force_authenticate(self.anna)

    def payload(self, **changes):
        data = {"employee": self.master.id, "service": self.service.id, "date": str(self.day), "start_time": "10:00"}
        data.update(changes)
        return data

    def post(self, **changes):
        return self.client.post(URL, self.payload(**changes))

    # ----- обязательные поля и формат -----

    def test_success(self):
        r = self.post()
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual((data["status"], data["start_time"], data["end_time"]), ("pending", "10:00:00", "11:00:00"))
        self.assertEqual(data["price"], "1000.00")
        booking = Booking.objects.get()
        self.assertEqual(booking.client, self.anna)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.post().status_code, 401)
        self.assertEqual(Booking.objects.count(), 0)

    def test_required_fields(self):
        r = self.client.post(URL, {})
        self.assertEqual(r.status_code, 400)
        for field in ("employee", "service", "date", "start_time"):
            self.assertIn(field, r.json())

    def test_invalid_values(self):
        cases = {
            "date": [str(self.today - timedelta(days=1)),  # прошедшая дата
                     str(self.today + timedelta(days=MAX_DAYS_AHEAD + 1)),  # слишком далеко
                     "31.12.2030", "abc"],
            "start_time": ["25:00", "10-00", "abc"],
            "employee": [999999, "abc"],
            "service": [999999, "abc"],
        }
        for field, values in cases.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    r = self.post(**{field: value})
                    self.assertEqual(r.status_code, 400)
                    self.assertIn(field, r.json())
        self.assertEqual(Booking.objects.count(), 0)

    def test_inactive_master_or_service(self):
        Employee.objects.filter(pk=self.master.pk).update(is_active=False)
        self.assertIn("employee", self.post().json())
        Employee.objects.filter(pk=self.master.pk).update(is_active=True)
        Service.objects.filter(pk=self.service.pk).update(is_active=False)
        self.assertIn("service", self.post().json())

    # ----- правила записи -----

    def test_master_must_perform_the_service(self):
        other = Service.objects.create(name="Маникюр", price=500, duration_minutes=30)
        r = self.post(service=other.id)
        self.assertEqual(r.status_code, 400)
        self.assertIn("service", r.json())

    def test_time_must_fit_the_schedule(self):
        for at in ("09:00", "11:30", "13:00"):  # до начала, не успеет закончиться до 12:00, после конца
            with self.subTest(at=at):
                r = self.post(start_time=at)
                self.assertEqual(r.status_code, 400)
                self.assertIn("start_time", r.json())
        day_off = self.day + timedelta(days=1)  # в этот день у мастера нет графика
        self.assertIn("start_time", self.post(date=str(day_off)).json())

    def test_slot_cannot_be_taken_twice(self):
        self.assertEqual(self.post().status_code, 201)
        self.client.force_authenticate(self.bob)
        for at in ("10:00", "10:30"):  # то же время и пересечение
            self.assertIn("start_time", self.post(start_time=at).json(), at)
        self.assertEqual(self.post(start_time="11:00").status_code, 201)  # сразу после — можно

    def test_client_cannot_be_at_two_masters_at_once(self):
        second = Employee.objects.create(full_name="Второй мастер", specialization="—")
        second.services.add(self.service)
        Schedule.objects.create(employee=second, day_of_week=self.day.weekday(), start_time=time(10), end_time=time(12))
        self.assertEqual(self.post().status_code, 201)

        r = self.post(employee=second.id)  # то же время у другого мастера
        self.assertEqual(r.status_code, 400)
        self.assertIn("У вас уже есть запись", str(r.json()["start_time"]))
        self.assertEqual(self.post(employee=second.id, start_time="11:00").status_code, 201)

    def test_blocked_client(self):
        ClientProfile.objects.create(client=self.anna, is_blocked=True)
        r = self.post()
        self.assertEqual(r.status_code, 400)
        self.assertIn(BLOCKED_MESSAGE, str(r.json()))
        self.assertEqual(Booking.objects.count(), 0)

    # ----- комментарий -----

    def test_comment(self):
        r = self.post(comment="  Аллергия на аммиак  ")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Booking.objects.get().comment, "Аллергия на аммиак")

        r = self.post(comment="а" * 501, start_time="11:00")
        self.assertEqual(r.status_code, 400)
        self.assertIn("comment", r.json())

        self.assertEqual(self.post(comment="", start_time="11:00").status_code, 201)  # можно без комментария

    # ----- промокод -----

    def test_promo_code(self):
        PromoCode.objects.create(code="sale10", discount_percent=10)
        r = self.post(promo_code="sale10")  # регистр не важен
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["price"], "900.00")
        self.assertEqual(Booking.objects.get().promo_code.code, "SALE10")

        r = self.post(promo_code="SALE10", start_time="11:00")  # одному клиенту — один раз
        self.assertEqual(r.status_code, 400)
        self.assertIn("promo_code", r.json())

    def test_invalid_promo_codes(self):
        PromoCode.objects.create(code="OLD", discount_percent=10, valid_to=self.today - timedelta(days=1))
        PromoCode.objects.create(code="LATER", discount_percent=10, valid_from=self.today + timedelta(days=1))
        PromoCode.objects.create(code="OFF", discount_percent=10, is_active=False)
        for code in ("NOPE", "OLD", "LATER", "OFF"):
            with self.subTest(code=code):
                r = self.post(promo_code=code)
                self.assertEqual(r.status_code, 400)
                self.assertIn("promo_code", r.json())
        self.assertEqual(Booking.objects.count(), 0)

    def test_promo_code_usage_limit(self):
        PromoCode.objects.create(code="ONE", discount_percent=20, max_uses=1)
        self.assertEqual(self.post(promo_code="ONE").status_code, 201)
        self.client.force_authenticate(self.bob)
        r = self.post(promo_code="ONE", start_time="11:00")
        self.assertEqual(r.status_code, 400)
        self.assertIn("promo_code", r.json())

    def test_promo_check_endpoint(self):
        PromoCode.objects.create(code="SALE10", discount_percent=10)
        url = "/api/bookings/promo/"
        r = self.client.get(url, {"code": "sale10", "service_id": self.service.id, "date": str(self.day)})
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()["discount_percent"], r.json()["price"]), (10, "900.00"))
        self.assertEqual(self.client.get(url, {"code": "NOPE"}).status_code, 400)
        self.assertEqual(self.client.get(url).status_code, 400)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url, {"code": "SALE10"}).status_code, 401)
