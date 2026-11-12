from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Service

User = get_user_model()


class ServiceTagsTests(APITestCase):
    def setUp(self):
        self.service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60)
        self.url = f"/api/services/{self.service.id}/"

    def test_staff_picks_tags_from_list(self):
        self.client.force_authenticate(User.objects.create_user("boss", password="x", is_staff=True, is_superuser=True))
        r = self.client.patch(self.url, {"tags": ["women", "hit", "women"]}, format="json")
        self.assertEqual(r.json()["tags"], ["hit", "women"])  # без повторов, в порядке списка
        self.assertEqual(self.client.patch(self.url, {"tags": ["скидка"]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(self.url, {"tags": "hit"}, format="json").status_code, 400)

    def test_tags_are_public_but_read_only(self):
        self.assertEqual(self.client.get(self.url).json()["tags"], [])
        self.client.force_authenticate(User.objects.create_user("anna", password="x"))
        self.assertEqual(self.client.patch(self.url, {"tags": ["hit"]}, format="json").status_code, 403)
