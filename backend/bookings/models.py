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
