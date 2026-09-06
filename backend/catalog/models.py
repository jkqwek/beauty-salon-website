from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Service(models.Model): #класс сервиса для бд
    name = models.CharField("Название", max_length=100)
    description = models.TextField("Описание", blank=True)
    price = models.DecimalField("Цена", max_digits=8, decimal_places=2)
    duration_minutes = models.PositiveIntegerField("Длительность (мин)") #для расчёта столов записи
    category = models.CharField("Категория", max_length=50, blank=True) #пригодится для фильтрации
    is_active = models.BooleanField("Активен", default=True)
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)

    class Meta:
        verbose_name = "Услуга"
        verbose_name_plural = "Услуги"

    def __str__(self):
        return self.name

class Employee(models.Model): #класс сотрудника для бд
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name="employee_profile",
        null=True, blank=True,
    )
    full_name = models.CharField("ФИО", max_length=100)
    specialization = models.CharField("Специализация", max_length=100)
    phone = models.CharField("Телефон", max_length=20, blank=True)
    photo = models.ImageField("Фото", upload_to="employees/", blank=True, null=True)
    services = models.ManyToManyField(Service, related_name="employees", blank=True)
    is_active = models.BooleanField("Работает", default=True)

    class Meta:
        verbose_name = "Сотрудник"
        verbose_name_plural = "Сотрудники"

    def __str__(self):
        return self.full_name