"""Подарочные сертификаты (задача 153): заказ, активация, оплата записи, возврат при отмене."""
from datetime import time, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from catalog.models import Employee, Service
from .models import Booking, CancellationPolicy, GiftCertificate, PromoCode, Schedule

User = get_user_model()
GIFTS = "/api/bookings/gift-certificates/"


class GiftCertificateTests(APITestCase):
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
        self.day = timezone.localdate() + timedelta(days=3)
        Schedule.objects.create(employee=self.master, day_of_week=self.day.weekday(),
                                start_time=time(10), end_time=time(13))
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 24})
        self.client.force_authenticate(self.anna)

    def gift(self, amount=3000, paid=True, **extra):
        gift = GiftCertificate.objects.create(buyer=self.bob, amount=amount, **extra)
        if paid:
            gift.activate()
        return gift

    def book(self, at="10:00", **extra):
        data = {"employee": self.master.id, "service": self.service.id, "date": str(self.day), "start_time": at}
        data.update(extra)
        return self.client.post("/api/bookings/", data)

    # ----- заказ сертификата -----

    def test_order_certificate(self):
        r = self.client.post(GIFTS, {"amount": 3000, "recipient_name": "Мария", "message": "С днём рождения!"})
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertTrue(data["code"].startswith("GIFT-"))
        self.assertEqual((data["status"], data["is_paid"], data["balance"]), ("pending", False, "3000.00"))
        gift = GiftCertificate.objects.get()
        self.assertEqual(gift.buyer, self.anna)
        self.assertEqual(gift.valid_until, timezone.localdate() + timedelta(days=365))

    def test_order_validation(self):
        for amount in (100, 499, 50001, "abc", ""):
            with self.subTest(amount=amount):
                r = self.client.post(GIFTS, {"amount": amount})
                self.assertEqual(r.status_code, 400)
                self.assertIn("amount", r.json())
        self.assertEqual(self.client.post(GIFTS, {}).status_code, 400)
        self.assertEqual(GiftCertificate.objects.count(), 0)

    def test_order_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(GIFTS, {"amount": 1000}).status_code, 401)
        self.assertEqual(self.client.get(GIFTS).status_code, 401)

    def test_codes_are_unique_and_my_list_is_private(self):
        codes = {self.client.post(GIFTS, {"amount": 1000}).json()["code"] for _ in range(5)}
        self.assertEqual(len(codes), 5)
        self.gift()  # сертификат bob
        mine = self.client.get(GIFTS).json()
        self.assertEqual(len(mine), 5)
        self.assertEqual({g["code"] for g in mine}, codes)

    # ----- проверка кода -----

    def test_check_code(self):
        gift = self.gift()
        r = self.client.get(GIFTS + "check/", {"code": gift.code.lower()})  # регистр не важен
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["balance"], "3000.00")

    def test_check_rejects_bad_codes(self):
        unpaid = self.gift(paid=False)
        expired = self.gift()
        GiftCertificate.objects.filter(pk=expired.pk).update(valid_until=timezone.localdate() - timedelta(days=1))
        used = self.gift()
        GiftCertificate.objects.filter(pk=used.pk).update(balance=0)
        for code in ("", "GIFT-NOPE-NOPE", unpaid.code, expired.code, used.code):
            with self.subTest(code=code):
                r = self.client.get(GIFTS + "check/", {"code": code})
                self.assertEqual(r.status_code, 400)
                self.assertIn("code", r.json())

    # ----- оплата записи сертификатом -----

    def test_certificate_covers_the_whole_price(self):
        gift = self.gift(3000)
        r = self.book(gift_code=gift.code)
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual((data["price"], data["gift_amount"], data["to_pay"]), ("1000.00", "1000.00", "0.00"))
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("2000.00"))  # остаток можно потратить на следующую запись

    def test_certificate_covers_part_of_the_price(self):
        gift = self.gift(500)
        data = self.book(gift_code=gift.code).json()
        self.assertEqual((data["gift_amount"], data["to_pay"]), ("500.00", "500.00"))
        gift.refresh_from_db()
        self.assertEqual(gift.balance, 0)
        r = self.book(at="11:00", gift_code=gift.code)  # сертификат уже использован
        self.assertEqual(r.status_code, 400)
        self.assertIn("gift_code", r.json())

    def test_certificate_works_with_promo_code(self):
        PromoCode.objects.create(code="SALE10", discount_percent=10)
        gift = self.gift(3000)
        data = self.book(promo_code="SALE10", gift_code=gift.code).json()
        self.assertEqual((data["price"], data["gift_amount"]), ("900.00", "900.00"))

    def test_anyone_with_the_code_can_use_it(self):
        gift = self.gift(3000)  # куплен bob, использует anna — это же подарок
        self.assertEqual(self.book(gift_code=gift.code).status_code, 201)

    def test_bad_certificate_does_not_create_booking(self):
        unpaid = self.gift(paid=False)
        for code in ("GIFT-NOPE-NOPE", unpaid.code):
            r = self.book(gift_code=code)
            self.assertEqual(r.status_code, 400)
            self.assertIn("gift_code", r.json())
        self.assertEqual(Booking.objects.count(), 0)

    def test_booking_without_certificate_is_unchanged(self):
        data = self.book().json()
        self.assertEqual((data["gift_amount"], data["to_pay"]), ("0.00", "1000.00"))

    # ----- возврат при отмене и переносе -----

    def test_cancel_returns_money_to_certificate(self):
        gift = self.gift(3000)
        booking_id = self.book(gift_code=gift.code).json()["id"]
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("2000.00"))

        self.assertEqual(self.client.post(f"/api/bookings/{booking_id}/cancel/").status_code, 200)
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("3000.00"))

        booking = Booking.objects.get(pk=booking_id)
        booking.save()  # повторное сохранение не вернёт деньги второй раз
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("3000.00"))

    def test_cancel_in_admin_also_returns_money(self):
        gift = self.gift(3000)
        booking = Booking.objects.get(pk=self.book(gift_code=gift.code).json()["id"])
        booking.status = "cancelled"
        booking.save()
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("3000.00"))

    def test_cancel_without_certificate_changes_nothing(self):
        gift = self.gift(3000)
        booking_id = self.book().json()["id"]
        self.client.post(f"/api/bookings/{booking_id}/cancel/")
        gift.refresh_from_db()
        self.assertEqual(gift.balance, Decimal("3000.00"))

    def test_admin_activation(self):
        gift = self.gift(paid=False)
        self.assertEqual(gift.status, "pending")
        gift.activate()
        gift.refresh_from_db()
        self.assertEqual((gift.is_paid, gift.status), (True, "active"))
