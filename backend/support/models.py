from django.db import models
from django.conf import settings

class BugReport(models.Model):
    STATUS_CHOICES = [
        ("new", "Новое"),
        ("in_progress", "В работе"),
        ("resolved", "Решено"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="bug_reports")
    contact = models.CharField("Контакт (телефон/email)", max_length=255, blank=True)
    text = models.TextField("Описание проблемы")
    status = models.CharField("Статус", max_length=20, choices=STATUS_CHOICES, default="new")
    created_at = models.DateTimeField("Дата", auto_now_add=True)

    class Meta:
        verbose_name = "Сообщение об ошибке"
        verbose_name_plural = "Сообщения об ошибках"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Баг #{self.id} от {self.user.username if self.user else 'Гостя'}"