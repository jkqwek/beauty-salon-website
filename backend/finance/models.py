from django.db import models

class Expense(models.Model):
    category = models.CharField("Категория", max_length=100)
    amount = models.DecimalField("Сумма", max_digits=10, decimal_places=2)
    description = models.TextField("Описание", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField("Дата расходов")
    
    class Meta:
        verbose_name = "Расход"
        verbose_name_plural = "Расходы"
        ordering = ["-date"]
    
    def __str__(self):
        return f"{self.category} - {self.amount} ({self.date})"


class StockItem(models.Model):
    CATEGORY_CHOICES = [
        ("cosmetics", "Косметика"),
        ("consumables", "Расходные материалы"),
    ]
    name = models.CharField("Название", max_length=100)
    category = models.CharField("Категория", max_length=20, choices=CATEGORY_CHOICES)
    quantity = models.PositiveIntegerField("Остаток", default=0)  # PositiveInteger: в минус не уйдёт на уровне БД
    unit = models.CharField("Ед. изм.", max_length=10, default="шт")
    min_quantity = models.PositiveIntegerField("Минимальный остаток", default=0)

    class Meta:
        verbose_name = "Позиция на складе"
        verbose_name_plural = "Склад"
        ordering = ["category", "name"]

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"