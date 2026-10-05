import os
import tempfile
from datetime import time, timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from accounts.models import ClientProfile
from catalog.models import Employee, Service
from .models import Booking, Schedule, TimeOff

User = get_user_model()


class StaffPanelTests(APITestCase):
    def setUp(self):
        self.master_user = User.objects.create_user("master", password="x", is_staff=True, is_superuser=True)
        self.master = Employee.objects.create(user=self.master_user, full_name="Мастер", specialization="—")
        other = Employee.objects.create(full_name="Другой", specialization="—")
        self.buyer = User.objects.create_user("anna", password="x")
        service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60)

        today = timezone.localdate()
        mk = lambda emp, d, status: Booking.objects.create(
            client=self.buyer, employee=emp, service=service, date=d,
            start_time=time(10), end_time=time(11), status=status, price=1000,
        )
        self.today_booking = mk(self.master, today, "confirmed")
        mk(self.master, today - timedelta(days=7), "completed")
        mk(other, today - timedelta(days=3), "completed")  # визит к другому мастеру не считается

    def test_buyer_has_no_access(self):
        self.client.force_authenticate(self.buyer)
        for url in ["/api/bookings/employee/", "/api/admin/users/", "/api/admin/bookings/",
                    "/api/finance/stock/", "/api/bookings/reports/popular-services/"]:
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_roles(self):
        self.client.force_authenticate(self.master_user)
        url = f"/api/admin/users/{self.buyer.id}/"

        # покупатель -> сотрудник: полные права (и в Django-админке)
        self.assertTrue(self.client.patch(url, {"is_staff": True}).json()["is_staff"])
        self.buyer.refresh_from_db()
        self.assertTrue(self.buyer.is_superuser)
        self.client.patch(url, {"is_staff": False})
        self.buyer.refresh_from_db()
        self.assertFalse(self.buyer.is_superuser)

        # с себя статус снять нельзя
        r = self.client.patch(f"/api/admin/users/{self.master_user.id}/", {"is_staff": False})
        self.assertEqual(r.status_code, 400)

        # сотрудник без карточки мастера: кабинета нет, но панель доступна
        self.client.force_authenticate(self.buyer)  # уже покупатель
        self.assertEqual(self.client.get("/api/admin/users/").status_code, 403)
        boss = User.objects.create_user("boss", password="x", is_staff=True)
        self.client.force_authenticate(boss)
        self.assertEqual(self.client.get("/api/bookings/employee/").status_code, 404)
        self.assertEqual(self.client.get("/api/finance/stock/").status_code, 200)

    def test_cabinet_timer_and_note(self):
        self.client.force_authenticate(self.master_user)
        r = self.client.patch(f"/api/admin/users/{self.buyer.id}/", {"note": "Аллергия на аммиак"})
        self.assertEqual(r.json()["note"], "Аллергия на аммиак")

        data = self.client.get("/api/bookings/employee/").json()
        self.assertEqual([b["id"] for b in data["bookings"]], [self.today_booking.id])
        self.assertEqual(data["clients"], [
            {"id": self.buyer.id, "name": "anna", "visits": 1, "phone": "", "note": "Аллергия на аммиак",
             "is_regular": False}
        ])

        # тайм-трекинг: старт -> финиш -> повторно нельзя
        url = f"/api/bookings/{self.today_booking.id}/track-time/"
        self.assertIsNotNone(self.client.post(url).json()["actual_start"])
        r = self.client.post(url).json()
        self.assertEqual(r["status"], "completed")
        self.assertIsNotNone(r["actual_end"])
        self.assertEqual(self.client.post(url).status_code, 400)

        # фактические часы попадают в отчёт по загрузке
        rows = self.client.get("/api/finance/employee-workload/").json()
        master_row = next(r for r in rows if r["employee_id"] == self.master.id)
        self.assertEqual(master_row["actual_hours"], 0.0)  # секунды между кликами
        self.assertEqual(master_row["total_hours"], 2.0)

        # записи за день в панели, менять можно только статус
        today = timezone.localdate()
        day = self.client.get(f"/api/admin/bookings/?date_from={today}&date_to={today}").json()
        self.assertEqual([b["id"] for b in day], [self.today_booking.id])
        r = self.client.patch(f"/api/admin/bookings/{self.today_booking.id}/", {"status": "cancelled", "price": 1})
        self.assertEqual((r.json()["status"], r.json()["price"]), ("cancelled", "1000.00"))
        self.assertEqual(self.client.get("/api/admin/bookings/?date_from=вчера").status_code, 400)

    def test_cancellation_policy(self):
        future = Booking.objects.create(
            client=self.buyer, employee=self.master, service=self.today_booking.service,
            date=timezone.localdate() + timedelta(days=2), start_time=time(10), end_time=time(11),
        )  # до начала 38–58 ч
        policy_url, cancel_url = "/api/bookings/cancellation-policy/", f"/api/bookings/{future.id}/cancel/"

        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.get(policy_url).json(), {"deadline_hours": 24})
        self.assertEqual(self.client.patch(policy_url, {"deadline_hours": 0}).status_code, 403)

        self.client.force_authenticate(self.master_user)
        self.client.patch(policy_url, {"deadline_hours": 72})
        self.client.force_authenticate(self.buyer)
        r = self.client.post(cancel_url)
        self.assertEqual(r.status_code, 400)
        self.assertIn("72 ч", r.json()["error"])
        self.assertEqual(self.client.post(f"/api/bookings/{future.id}/reschedule/",
                                          {"date": "2030-01-01", "start_time": "10:00"}).status_code, 400)

        self.client.force_authenticate(self.master_user)
        self.client.patch(policy_url, {"deadline_hours": 24})
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.post(cancel_url).json()["status"], "cancelled")

    def test_salon_load_and_client_stats(self):
        today = timezone.localdate()
        Schedule.objects.create(employee=self.master, day_of_week=today.weekday(), start_time=time(10), end_time=time(12))
        TimeOff.objects.create(employee=self.master, date=today, start_time=time(11, 30), end_time=time(12))
        self.client.force_authenticate(self.master_user)

        data = self.client.get(f"/api/admin/load/?date={today}").json()
        self.assertEqual(data["hours"], [10, 11])
        row = next(m for m in data["masters"] if m["id"] == self.master.id)
        self.assertEqual(row["cells"], [
            {"hour": 10, "work": 60, "busy": 60, "blocked": 0},  # запись 10:00–11:00
            {"hour": 11, "work": 60, "busy": 0, "blocked": 30},  # блокировка 11:30–12:00
        ])
        self.assertEqual((row["load"], data["load"]), (67, 67))  # 60 мин из 90 доступных
        self.assertIsNone(next(m for m in data["masters"] if m["id"] != self.master.id)["load"])  # выходной

        url = f"/api/admin/users/{self.buyer.id}/"
        self.client.patch(url, {"phone": "+7 (999) 123-45-67"})
        user = self.client.patch(url, {"note": "Любит кофе"}).json()
        self.assertEqual((user["phone"], user["note"]), ("+7 (999) 123-45-67", "Любит кофе"))  # телефон не затёрся
        self.assertEqual(
            (user["visits"], user["last_visit"], user["total_spent"]),
            (2, str(today - timedelta(days=3)), "2000.00"),  # завершённые визиты ко всем мастерам
        )


class AdminPanelV2Tests(APITestCase):
    """Статусы с подтверждением, чёрный список, ⭐ постоянные, профиль и аватары."""

    def setUp(self):
        self.staff = User.objects.create_user("boss", password="x", is_staff=True, is_superuser=True)
        self.master = Employee.objects.create(user=self.staff, full_name="Мастер", specialization="—")
        self.service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60)
        self.master.services.add(self.service)
        self.buyer = User.objects.create_user("anna", password="x", email="anna@x.ru")
        self.tomorrow = timezone.localdate() + timedelta(days=1)
        Schedule.objects.create(employee=self.master, day_of_week=self.tomorrow.weekday(),
                                start_time=time(10), end_time=time(12))

    def book(self, user, at="10:00"):
        self.client.force_authenticate(User.objects.get(pk=user.pk))  # свежий объект, без закешированного profile
        return self.client.post("/api/bookings/", {
            "employee": self.master.id, "service": self.service.id, "date": str(self.tomorrow), "start_time": at,
        })

    def visit(self, days_ago):
        Booking.objects.create(client=self.buyer, employee=self.master, service=self.service, price=1000,
                               date=timezone.localdate() - timedelta(days=days_ago),
                               start_time=time(10), end_time=time(11), status="completed")

    def buyer_row(self):
        self.client.force_authenticate(self.staff)
        return next(u for u in self.client.get("/api/admin/users/").json() if u["id"] == self.buyer.id)

    def test_statuses(self):
        # онлайн-запись ждёт подтверждения, но время уже занято
        first = self.book(self.buyer).json()
        self.assertEqual(first["status"], "pending")
        slots = self.client.get(f"/api/bookings/available-slots/?employee_id={self.master.id}"
                                f"&service_id={self.service.id}&date={self.tomorrow}").json()["slots"]
        self.assertEqual(slots, ["11:00"])

        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get("/api/admin/bookings/pending-count/").json(), {"count": 1})
        url = f"/api/admin/bookings/{first['id']}/"
        self.assertEqual(self.client.patch(url, {"status": "cancelled"}).json()["status"], "cancelled")

        # время освободилось и его занял другой — вернуть отменённую нельзя
        other = User.objects.create_user("ivan", password="x")
        self.assertEqual(self.book(other).status_code, 201)
        self.client.force_authenticate(self.staff)
        r = self.client.patch(url, {"status": "confirmed"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["errors"]["status"], ["Это время уже занято другой записью."])

        # период: сегодня — пусто, с завтрашнего дня — обе записи
        today = timezone.localdate()
        self.assertEqual(self.client.get(f"/api/admin/bookings/?date_from={today}&date_to={today}").json(), [])
        self.assertEqual(len(self.client.get(f"/api/admin/bookings/?date_from={self.tomorrow}").json()), 2)

        # «Начать» у неподтверждённой сегодняшней записи сразу подтверждает её
        pending = Booking.objects.create(client=other, employee=self.master, service=self.service,
                                         date=today, start_time=time(18), end_time=time(19))
        r = self.client.post(f"/api/bookings/{pending.id}/track-time/").json()
        self.assertEqual(r["status"], "confirmed")

    def test_blacklist(self):
        self.client.force_authenticate(self.staff)
        url = f"/api/admin/users/{self.buyer.id}/"
        r = self.client.patch(url, {"is_blocked": True, "blocked_reason": "Трижды не пришла"}).json()
        self.assertTrue(r["is_blocked"])
        self.assertIsNotNone(r["blocked_at"])
        r = self.client.patch(f"/api/admin/users/{self.staff.id}/", {"is_blocked": True})
        self.assertEqual(r.status_code, 400)  # сотрудника блокировать нельзя

        self.client.force_authenticate(self.buyer)
        self.assertTrue(self.client.get("/api/auth/me/").json()["is_blocked"])
        r = self.book(self.buyer)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()["detail"], "Онлайн-запись недоступна. Свяжитесь с салоном.")

        self.client.force_authenticate(self.staff)
        r = self.client.patch(url, {"is_blocked": False}).json()
        self.assertEqual((r["is_blocked"], r["blocked_at"], r["blocked_reason"]), (False, None, ""))
        self.assertEqual(self.book(self.buyer).status_code, 201)

    def test_regular_candidates(self):
        for days_ago in (10, 40, 70, 100, 400):  # 4 визита за полгода + 1 старый
            self.visit(days_ago)
        self.assertFalse(self.buyer_row()["is_candidate"])
        self.visit(130)  # пятый за полгода
        row = self.buyer_row()
        self.assertEqual((row["is_candidate"], row["visits"]), (True, 6))
        self.client.patch(f"/api/admin/users/{self.buyer.id}/", {"is_regular": True})
        row = self.buyer_row()
        self.assertEqual((row["is_regular"], row["is_candidate"]), (True, False))

    def test_profile_and_avatars(self):
        User.objects.create_user("olga", password="x", email="taken@x.ru")
        self.client.force_authenticate(self.buyer)
        self.assertEqual(self.client.patch("/api/auth/me/", {"email": "TAKEN@x.ru"}).status_code, 400)
        me = self.client.patch("/api/auth/me/", {"first_name": "Анна", "phone": "+7 999 000-00-00"}).json()
        self.assertEqual((me["first_name"], me["phone"], me["email"]), ("Анна", "+7 999 000-00-00", "anna@x.ru"))

        def image(fmt, size=(1200, 800)):
            buf = BytesIO()
            Image.new("RGBA" if fmt == "PNG" else "RGB", size, "red").save(buf, fmt)
            return SimpleUploadedFile(f"a.{fmt.lower()}", buf.getvalue())

        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            r = self.client.put("/api/auth/me/avatar/", {"avatar": image("PNG")}, format="multipart")
            self.assertTrue(r.json()["avatar"].endswith(".jpg"))
            path = ClientProfile.objects.get(client=self.buyer).avatar.path
            with Image.open(path) as saved:
                self.assertEqual((saved.format, saved.size), ("JPEG", (600, 400)))  # пересжато до 600 px
            for bad in (image("GIF"), SimpleUploadedFile("a.png", b"not an image")):
                r = self.client.put("/api/auth/me/avatar/", {"avatar": bad}, format="multipart")
                self.assertEqual(r.status_code, 400)
            self.assertIsNone(self.client.delete("/api/auth/me/avatar/").json()["avatar"])
            self.assertFalse(os.path.exists(path))  # файл удалён с диска

            # фото карточки мастера загружает только сотрудник
            photo_url = f"/api/employees/{self.master.id}/photo/"
            r = self.client.put(photo_url, {"photo": image("JPEG")}, format="multipart")
            self.assertEqual(r.status_code, 403)
            self.client.force_authenticate(self.staff)
            r = self.client.put(photo_url, {"photo": image("JPEG")}, format="multipart")
            self.assertIn("/media/employees/", r.json()["photo"])
            self.assertIsNone(self.client.delete(photo_url).json()["photo"])
