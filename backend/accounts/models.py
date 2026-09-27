from django.conf import settings
from django.db import models


class ClientProfile(models.Model):
    """Данные клиента для салона: телефон и внутренний комментарий ("Аллергия на аммиак").
    Клиенту комментарий не показывается."""
    client = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    phone = models.CharField("Телефон", max_length=20, blank=True)
    note = models.TextField("Внутренний комментарий", blank=True)

    class Meta:
        verbose_name = "Профиль клиента"
        verbose_name_plural = "Профили клиентов"

    def __str__(self):
        return f"{self.client}: {self.phone}"
