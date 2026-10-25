from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from catalog.models import Employee, Service
from django.contrib.auth import get_user_model

User = get_user_model()


class Schedule(models.Model):
    DAY_CHOICES = [
        (0, 'Понедельник'),
        (1, 'Вторник'),
        (2, 'Среда'),
        (3, 'Четверг'),
        (4, 'Пятница'),
        (5, 'Суббота'),
        (6, 'Воскресенье'),
    ]
    
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name='schedules'
    )
    
    day_of_week = models.IntegerField("День недели", choices=DAY_CHOICES)
    start_time = models.TimeField("Начало работы")
    end_time = models.TimeField("Конец работы")

    class Meta:
        verbose_name = "График работы"
        verbose_name_plural = "Графики работы"
        unique_together = ("employee", "day_of_week")
        ordering = ["employee", "day_of_week"]

    def __str__(self):
        return f"{self.employee} — {self.get_day_of_week_display()} {self.start_time}-{self.end_time}"


# запись ещё впереди и держит время мастера
ACTIVE_STATUSES = ("pending", "confirmed")


class Booking(models.Model):
    STATUS_CHOISES = [
        ("pending", "Ждёт подтверждения"),
        ("confirmed", "Подтверждена"),
        ("completed", "Выполнена"),
        ("cancelled", "Отменена"),
    ]
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bookings')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='bookings')
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='bookings')
    date = models.DateField("Дата записи")
    start_time = models.TimeField("Время начала")
    end_time = models.TimeField("Время окончания")
    status = models.CharField("Статус", max_length=10, choices=STATUS_CHOISES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    price = models.DecimalField('Цена', max_digits=10, decimal_places=2, null=True, blank=True)
    # тайм-трекинг: мастер жмёт "Начать"/"Завершить" в своём кабинете
    actual_start = models.DateTimeField("Фактическое начало", null=True, blank=True)
    actual_end = models.DateTimeField("Фактическое окончание", null=True, blank=True)
    rating = models.PositiveSmallIntegerField("Оценка клиента", null=True, blank=True)
    survey_sent = models.BooleanField("Опрос отправлен", default=False)
    comment = models.CharField("Комментарий клиента", max_length=500, blank=True)
    promo_code = models.ForeignKey("PromoCode", on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name="bookings", verbose_name="Промокод")

    class Meta:
        verbose_name = "Запись"
        verbose_name_plural = "Записи"
        ordering = ["-date", "-start_time"]
    
    def __str__(self):
        return f"{self.client} → {self.employee} ({self.date} {self.start_time})"


class TimeOff(models.Model):
    """Ручная блокировка времени у мастера: обед, перерыв, отгул."""
    employee = models.ForeignKey("catalog.Employee", on_delete=models.CASCADE, related_name="time_offs")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["date", "start_time"]

    def __str__(self):
        return f"{self.employee} — {self.date} {self.start_time}-{self.end_time}"


class SalonClosure(models.Model):
    """Праздник или выходной салона на период дат. Часы не заданы — закрыто, заданы — сокращённый день."""
    name = models.CharField("Название", max_length=100)  # видят клиенты: в календаре и на баннере
    date_from = models.DateField("С")
    date_to = models.DateField("По")
    open_time = models.TimeField("Открыто с", null=True, blank=True)
    close_time = models.TimeField("Открыто до", null=True, blank=True)

    class Meta:
        verbose_name = "Праздник или выходной"
        verbose_name_plural = "Праздники и выходные"
        ordering = ["date_from"]

    def __str__(self):
        return f"{self.name}: {self.date_from}–{self.date_to}"

    @property
    def is_closed(self):
        return self.open_time is None

    @property
    def label(self):
        return self.name if self.is_closed else f"{self.name} (с {self.open_time:%H:%M} до {self.close_time:%H:%M})"


class Review(models.Model):
    """Отзыв о визите. Оценка хранится в Booking.rating (общая с ботом); здесь текст, модерация и ответ салона."""
    STATUS_CHOICES = [
        ("new", "На модерации"),
        ("published", "Опубликован"),
        ("rejected", "Не опубликован"),
    ]
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name="review")
    text = models.TextField("Текст")
    status = models.CharField("Статус", max_length=10, choices=STATUS_CHOICES, default="new")
    reply = models.TextField("Ответ салона", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Отзыв"
        verbose_name_plural = "Отзывы"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.booking.client} — {self.get_status_display()}"


MAX_REVIEW_PHOTOS = 3


class ReviewPhoto(models.Model):
    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField("Фото", upload_to="reviews/")

    class Meta:
        verbose_name = "Фото к отзыву"
        verbose_name_plural = "Фото к отзывам"
        ordering = ["id"]


BONUS_PERCENT = 5  # столько процентов цены выполненного визита возвращается баллами (1 балл = 1 ₽)
REVIEW_BONUS = 50  # баллов за отзыв, когда салон его опубликовал
REFERRAL_BONUS = 200  # баллов и пригласившему, и другу после первого выполненного визита друга


class BonusOperation(models.Model):
    """Движение бонусных баллов: + за визит или вручную, − списание при оплате в салоне.
    Баланс клиента — сумма всех его операций."""
    client = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bonus_operations")
    amount = models.IntegerField("Баллы")
    # начисление за визит; живёт, пока запись в статусе «выполнена»
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, null=True, blank=True, related_name="bonus")
    # начисление за опубликованный отзыв — одно на отзыв
    review = models.OneToOneField(Review, on_delete=models.CASCADE, null=True, blank=True, related_name="bonus")
    comment = models.CharField("Комментарий", max_length=200, blank=True)
    created_at = models.DateTimeField("Дата", auto_now_add=True)

    class Meta:
        verbose_name = "Бонусная операция"
        verbose_name_plural = "Бонусные баллы"
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.client}: {self.amount:+}"


class CancellationPolicy(models.Model):
    """Правило отмены: одна строка (pk=1), срок меняется в панели."""
    deadline_hours = models.PositiveIntegerField("Отмена и перенос не позднее чем за, ч", default=24)

    class Meta:
        verbose_name = verbose_name_plural = "Правило отмены"

    def __str__(self):
        return f"Не позднее чем за {self.deadline_hours} ч"

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]


class PromoCode(models.Model):
    """Промокод: клиент вводит его при записи, скидка считается от цены визита (после акций)."""
    code = models.CharField("Код", max_length=30, unique=True)
    discount_percent = models.PositiveSmallIntegerField(
        "Скидка, %", validators=[MinValueValidator(1), MaxValueValidator(100)])
    valid_from = models.DateField("Действует с", null=True, blank=True)
    valid_to = models.DateField("Действует по", null=True, blank=True)
    max_uses = models.PositiveIntegerField("Лимит использований", null=True, blank=True)  # пусто — без лимита
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Промокод"
        verbose_name_plural = "Промокоды"

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} (−{self.discount_percent}%)"


class Referral(models.Model):
    """«Приведи друга»: друг зарегистрировался по коду клиента. Баллы обоим — после первого визита друга."""
    referrer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="referrals")
    friend = models.OneToOneField(User, on_delete=models.CASCADE, related_name="referral")
    rewarded = models.BooleanField("Бонус начислен", default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Приглашение друга"
        verbose_name_plural = "Приглашения друзей"

    def __str__(self):
        return f"{self.referrer} → {self.friend}"
