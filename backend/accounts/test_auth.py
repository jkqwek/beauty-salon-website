"""Тесты API авторизации (задача 130): регистрация, вход, токены, смена и сброс пароля."""
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase

from accounts.models import ClientProfile
from bookings.models import Referral

User = get_user_model()
PASSWORD = "Str0ng-Pass-2026"
NEW_PASSWORD = "New-Pass-2027"


class RegistrationTests(APITestCase):
    url = "/api/auth/register/"

    def data(self, **extra):
        data = {"username": "newuser", "email": "New@Mail.com", "password": PASSWORD, "password2": PASSWORD}
        data.update(extra)
        return data

    def test_success(self):
        r = self.client.post(self.url, self.data())
        self.assertEqual(r.status_code, 201)
        user = User.objects.get(username="newuser")
        self.assertEqual(user.email, "new@mail.com")  # email приводится к нижнему регистру
        self.assertTrue(user.check_password(PASSWORD))
        self.assertNotIn("password", r.json())  # пароль в ответе не возвращается

    def test_required_fields(self):
        r = self.client.post(self.url, {})
        self.assertEqual(r.status_code, 400)
        for field in ("username", "email", "password", "password2"):
            self.assertIn(field, r.json())

    def test_passwords_must_match(self):
        r = self.client.post(self.url, self.data(password2="Other-Pass-2026"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("password2", r.json())
        self.assertFalse(User.objects.filter(username="newuser").exists())

    def test_weak_password(self):
        r = self.client.post(self.url, self.data(password="12345678", password2="12345678"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.json())

    def test_invalid_email(self):
        r = self.client.post(self.url, self.data(email="not-an-email"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.json())

    def test_duplicate_email_and_username(self):
        User.objects.create_user("taken", "new@mail.com", PASSWORD)
        r = self.client.post(self.url, self.data())  # тот же email в другом регистре
        self.assertEqual(r.status_code, 400)
        self.assertIn("email", r.json())

        User.objects.create_user("newuser", "other@mail.com", PASSWORD)
        r = self.client.post(self.url, self.data(email="free@mail.com"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("username", r.json())

    def test_phone_is_validated_and_normalized(self):
        r = self.client.post(self.url, self.data(phone="8 (900) 123-45-67"))
        self.assertEqual(r.status_code, 201)
        self.assertEqual(ClientProfile.objects.get(client__username="newuser").phone, "+79001234567")

        r = self.client.post(self.url, self.data(username="other", email="o@mail.com", phone="abc"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("phone", r.json())

    def test_referral_code(self):
        inviter = User.objects.create_user("old", "old@mail.com", PASSWORD)
        r = self.client.post(self.url, self.data(referral_code="BAD-1"))
        self.assertEqual(r.status_code, 400)
        self.assertIn("referral_code", r.json())

        r = self.client.post(self.url, self.data(referral_code=f"allure-{inviter.id}"))  # регистр не важен
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Referral.objects.get(friend__username="newuser").referrer, inviter)


class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("anna", "anna@mail.com", PASSWORD)

    def login(self, username="anna", password=PASSWORD):
        return self.client.post("/api/auth/login/", {"username": username, "password": password})

    def test_login_returns_tokens(self):
        r = self.login()
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.json())
        self.assertIn("refresh", r.json())

    def test_wrong_password_and_unknown_user(self):
        self.assertEqual(self.login(password="wrong").status_code, 401)
        self.assertEqual(self.login(username="nobody").status_code, 401)

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.login().status_code, 401)

    def test_me_requires_a_valid_token(self):
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-token")
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

        token = self.login().json()["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/auth/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["username"], "anna")

    def test_refresh_token(self):
        refresh = self.login().json()["refresh"]
        r = self.client.post("/api/auth/refresh/", {"refresh": refresh})
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.json())
        self.assertEqual(self.client.post("/api/auth/refresh/", {"refresh": "junk"}).status_code, 401)


class PasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("anna", "anna@mail.com", PASSWORD)

    def can_login(self, password):
        return self.client.post("/api/auth/login/", {"username": "anna", "password": password}).status_code == 200

    def test_change_password(self):
        url = "/api/auth/change-password/"
        body = {"old_password": PASSWORD, "new_password": NEW_PASSWORD}
        self.assertEqual(self.client.post(url, body).status_code, 401)  # без входа нельзя

        self.client.force_authenticate(self.user)
        r = self.client.post(url, {"old_password": "wrong", "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 400)
        self.assertIn("old_password", r.json())

        r = self.client.post(url, {"old_password": PASSWORD, "new_password": "123"})  # слабый новый пароль
        self.assertEqual(r.status_code, 400)
        self.assertIn("new_password", r.json())

        self.assertEqual(self.client.post(url, body).status_code, 200)
        self.client.force_authenticate(None)
        self.assertFalse(self.can_login(PASSWORD))
        self.assertTrue(self.can_login(NEW_PASSWORD))

    def test_password_reset_request_does_not_reveal_emails(self):
        url = "/api/auth/password-reset/"
        known = self.client.post(url, {"email": "anna@mail.com"})
        unknown = self.client.post(url, {"email": "ghost@mail.com"})
        self.assertEqual((known.status_code, unknown.status_code), (200, 200))
        self.assertEqual(known.json(), unknown.json())  # ответ одинаковый
        self.assertEqual(self.client.post(url, {"email": "not-an-email"}).status_code, 400)

    def test_password_reset_confirm(self):
        url = "/api/auth/password-reset/confirm/"
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)

        r = self.client.post(url, {"uid": uid, "token": "wrong", "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 400)
        self.assertIn("token", r.json())

        r = self.client.post(url, {"uid": "!!", "token": token, "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 400)
        self.assertIn("uid", r.json())

        r = self.client.post(url, {"uid": uid, "token": token, "new_password": "123"})  # слабый пароль
        self.assertEqual(r.status_code, 400)

        good = {"uid": uid, "token": token, "new_password": NEW_PASSWORD}
        self.assertEqual(self.client.post(url, good).status_code, 200)
        self.assertTrue(self.can_login(NEW_PASSWORD))
        self.assertEqual(self.client.post(url, good).status_code, 400)  # ссылка одноразовая
