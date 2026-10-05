from django.conf import settings
from django.db import models


class ClientProfile(models.Model):
    """Профиль пользователя: телефон и аватар, плюс служебные метки салона —
    комментарий ("Аллергия на аммиак"), ⭐ постоянный клиент, чёрный список. Метки клиенту не показываются."""
    client = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    phone = models.CharField("Телефон", max_length=20, blank=True)
    avatar = models.ImageField("Аватар", upload_to="avatars/", null=True, blank=True)
    note = models.TextField("Внутренний комментарий", blank=True)
    is_regular = models.BooleanField("Постоянный клиент", default=False)
    is_blocked = models.BooleanField("В чёрном списке", default=False)  # запрещает только онлайн-запись
    blocked_reason = models.CharField("Причина блокировки", max_length=200, blank=True)
    blocked_at = models.DateTimeField("Заблокирован", null=True, blank=True)

    class Meta:
        verbose_name = "Профиль клиента"
        verbose_name_plural = "Профили клиентов"

    def __str__(self):
        return f"{self.client}: {self.phone}"
