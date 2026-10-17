from decimal import ROUND_HALF_UP, Decimal

from django.db import models
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator

User = get_user_model()


class ServiceManager(models.Manager):
    """Менеджер по умолчанию — без удалённых услуг: их не видят сайт, бот, запись и списки услуг мастеров.
    Записи и отчёты по-прежнему видят услугу: связанные объекты Django берёт через базовый менеджер."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Service(models.Model):
    name = models.CharField("Название", max_length=100)
    description = models.TextField("Описание", blank=True)
    price = models.DecimalField("Цена", max_digits=8, decimal_places=2)
    duration_minutes = models.PositiveIntegerField("Длительность (мин)")
    category = models.CharField("Категория", max_length=50, blank=True)
    image = models.ImageField("Изображение", upload_to="services/", blank=True, null=True)  # <-- новое поле
    is_active = models.BooleanField("Активен", default=True)
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)
    deleted_at = models.DateTimeField("Удалена", null=True, blank=True)

    objects = ServiceManager()
    all_objects = models.Manager()

    class Meta:
        verbose_name = "Услуга"
        verbose_name_plural = "Услуги"

    def __str__(self):
        return self.name


class Employee(models.Model):
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
    rating = models.DecimalField("Рейтинг", max_digits=2, decimal_places=1,
                                 null=True, blank=True,
                                 validators=[MinValueValidator(0), MaxValueValidator(5)])
    commission_percent = models.DecimalField("Процент мастера, %", max_digits=5, decimal_places=2,
                                             default=30,
                                             validators=[MinValueValidator(0), MaxValueValidator(100)])

    class Meta:
        verbose_name = "Сотрудник"
        verbose_name_plural = "Сотрудники"

    def __str__(self):
        return self.full_name


class Promotion(models.Model):
    """Акция: скидка в процентах на выбранные услуги (или на все) для визитов в заданный период."""
    name = models.CharField("Название", max_length=100)
    description = models.TextField("Описание", blank=True)
    discount_percent = models.PositiveSmallIntegerField(
        "Скидка, %", validators=[MinValueValidator(1), MaxValueValidator(90)]
    )
    services = models.ManyToManyField(Service, related_name="promotions", blank=True,
                                      help_text="Пусто — скидка на все услуги")
    date_from = models.DateField("С")
    date_to = models.DateField("По")
    is_active = models.BooleanField("Активна", default=True)

    class Meta:
        verbose_name = "Акция"
        verbose_name_plural = "Акции"
        ordering = ["date_from"]

    def __str__(self):
        return f"{self.name} −{self.discount_percent}%"


def price_on(service, day):
    """Цена услуги на дату визита: одна, самая выгодная действующая акция, без суммирования.
    Возвращает (цена, акция или None)."""
    promo = (
        Promotion.objects.filter(is_active=True, date_from__lte=day, date_to__gte=day)
        .filter(Q(services=service) | Q(services__isnull=True))
        .order_by("-discount_percent")
        .first()
    )
    if promo is None:
        return service.price, None
    price = (service.price * (100 - promo.discount_percent) / 100).quantize(Decimal("1"), ROUND_HALF_UP)
    price = price.quantize(Decimal("0.01"))
    return price, promo