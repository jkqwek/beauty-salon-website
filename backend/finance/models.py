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