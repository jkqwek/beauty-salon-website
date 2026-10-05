"""Аватары (аккаунта и карточки мастера): проверка загруженного файла и сохранение."""
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

MAX_UPLOAD = 10 * 1024 * 1024  # 10 МБ
MAX_SIDE = 600  # фронт сам кадрирует до 600×600; это страховка от прямой загрузки огромных файлов


def save_image(instance, field, upload):
    """Проверить файл и сохранить его в instance.<field> как JPEG, удалив прежний файл."""
    if upload is None:
        raise ValidationError({field: "Выберите файл."})
    if upload.size > MAX_UPLOAD:
        raise ValidationError({field: "Файл больше 10 МБ."})
    try:
        img = Image.open(upload)
        img.load()
    except (UnidentifiedImageError, OSError):
        raise ValidationError({field: "Это не изображение."})
    if img.format not in ("JPEG", "PNG"):
        raise ValidationError({field: "Подходят только JPG и PNG."})

    rgba = img.convert("RGBA")
    img = Image.new("RGB", rgba.size, "white")  # прозрачный фон PNG -> белый
    img.paste(rgba, mask=rgba)
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=90)  # пересохранение заодно стирает EXIF (геолокацию и т.п.)

    delete_image(instance, field, save=False)
    getattr(instance, field).save(f"{uuid4().hex}.jpg", ContentFile(buf.getvalue()), save=True)


def delete_image(instance, field, save=True):
    if getattr(instance, field):
        getattr(instance, field).delete(save=save)


class RelativeImageField(serializers.ImageField):
    """URL от корня сайта (/media/…), а не http://адрес-бэкенда/…: работает через прокси фронтенда
    и при входе с другого устройства по сети. Загрузка — отдельными запросами через save_image."""

    def __init__(self, **kwargs):
        super().__init__(read_only=True, **kwargs)

    def to_representation(self, value):
        return value.url if value else None
