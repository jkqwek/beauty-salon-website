"""Постраничный вывод и поиск в списках панели (задачи 68 и 135)."""
from datetime import time, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ClientProfile
from bookings.models import Booking
from catalog.models import Employee, Service

User = get_user_model()
USERS = "/api/admin/users/"


class AdminUsersPaginationTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user("boss", password="x", is_staff=True, is_superuser=True)
        for i in range(24):
            User.objects.create_user(f"client{i:02d}", password="x")  # всего 25 пользователей
        self.client.force_authenticate(self.staff)

    def test_without_page_params_the_whole_list_is_returned(self):
        data = self.client.get(USERS).json()
        self.assertIsInstance(data, list)  # сайт ждёт обычный список
        self.assertEqual(len(data), 25)

    def test_pages(self):
        first = self.client.get(f"{USERS}?page=1&page_size=10").json()
        self.assertEqual(first["count"], 25)
        self.assertEqual(len(first["results"]), 10)
        self.assertIsNone(first["previous"])
        self.assertIsNotNone(first["next"])

        last = self.client.get(f"{USERS}?page=3&page_size=10").json()
        self.assertEqual(len(last["results"]), 5)
        self.assertIsNone(last["next"])
        self.assertIsNotNone(last["previous"])

        ids = []
        for page in (1, 2, 3):
            ids += [u["id"] for u in self.client.get(f"{USERS}?page={page}&page_size=10").json()["results"]]
        self.assertEqual(len(ids), 25)
        self.assertEqual(len(set(ids)), 25)  # страницы не пересекаются и ничего не теряется

    def test_default_page_size(self):
        r = self.client.get(f"{USERS}?page=1").json()
        self.assertEqual(len(r["results"]), 20)

    def test_wrong_page_is_404(self):
        for page in ("99", "0", "abc"):
            self.assertEqual(self.client.get(f"{USERS}?page={page}").status_code, 404, page)

    def test_clients_have_no_access(self):
        self.client.force_authenticate(User.objects.get(username="client00"))
        self.assertEqual(self.client.get(f"{USERS}?page=1").status_code, 403)

    def test_search_by_name_with_pagination(self):
        self.assertEqual(len(self.client.get(f"{USERS}?search=boss").json()), 1)
        r = self.client.get(f"{USERS}?search=client0&page=1&page_size=4").json()  # client00 … client09
        self.assertEqual((r["count"], len(r["results"])), (10, 4))
        self.assertEqual(self.client.get(f"{USERS}?search=nobody").json(), [])

    def test_search_by_phone_in_any_format(self):
        ClientProfile.objects.create(client=User.objects.get(username="client05"), phone="+79001234567")
        for query in ("900123", "89001234567", "8-900-123-45-67", "+7 900 123"):
            found = self.client.get(USERS, {"search": query}).json()
            self.assertEqual([u["username"] for u in found], ["client05"], query)

    def test_search_by_several_words(self):
        User.objects.filter(username="client07").update(first_name="Анна", last_name="Смирнова")
        found = self.client.get(USERS, {"search": "Анна Смирнова"}).json()
        self.assertEqual([u["username"] for u in found], ["client07"])


class AdminBookingsPaginationTests(APITestCase):
    def setUp(self):
        for name in ("notify_admin_new_appointment", "notify_master_new_booking"):
            patcher = patch(f"bookings.signals.{name}")
            patcher.start()
            self.addCleanup(patcher.stop)
        staff = User.objects.create_user("boss", password="x", is_staff=True, is_superuser=True)
        client = User.objects.create_user("anna", password="x")
        master = Employee.objects.create(full_name="Мастер", specialization="—")
        service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60)
        self.day = timezone.localdate() + timedelta(days=5)
        for hour in range(8, 20):  # 12 записей за один день
            Booking.objects.create(client=client, employee=master, service=service, price=1000, date=self.day,
                                   start_time=time(hour), end_time=time(hour + 1))
        self.url = f"/api/admin/bookings/?date_from={self.day}&date_to={self.day}"
        self.client.force_authenticate(staff)

    def test_whole_list_without_params(self):
        data = self.client.get(self.url).json()
        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 12)

    def test_pages(self):
        r = self.client.get(self.url + "&page=2&page_size=5").json()
        self.assertEqual((r["count"], len(r["results"])), (12, 5))
        last = self.client.get(self.url + "&page=3&page_size=5").json()
        self.assertEqual(len(last["results"]), 2)
        self.assertIsNone(last["next"])

    def test_pages_keep_time_order(self):
        times = []
        for page in (1, 2):
            times += [b["start_time"] for b in self.client.get(self.url + f"&page={page}&page_size=6").json()["results"]]
        self.assertEqual(times, sorted(times))
