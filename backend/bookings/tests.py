from datetime import time, timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

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
        self.today_booking = mk(self.master, today, "active")
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
            {"id": self.buyer.id, "name": "anna", "visits": 1, "phone": "", "note": "Аллергия на аммиак"}
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
        day = self.client.get(f"/api/admin/bookings/?date={timezone.localdate()}").json()
        self.assertEqual([b["id"] for b in day], [self.today_booking.id])
        r = self.client.patch(f"/api/admin/bookings/{self.today_booking.id}/", {"status": "cancelled", "price": 1})
        self.assertEqual((r.json()["status"], r.json()["price"]), ("cancelled", "1000.00"))
        self.assertEqual(self.client.get("/api/admin/bookings/?date=вчера").status_code, 400)

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
