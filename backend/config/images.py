"""Загруженные фото (аватары, фото к отзывам): проверка файла и сохранение."""
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

MAX_UPLOAD = 10 * 1024 * 1024  # 10 МБ
MAX_SIDE = 600  # фронт сам кадрирует до 600×600; это страховка от прямой загрузки огромных файлов


def prepare_image(upload, field, max_side=MAX_SIDE):
    """Проверить загруженный файл и пересохранить его как JPEG не больше max_side по большей стороне."""
    if upload is None:
        raise ValidationError({field: "Выберите файл."})
    if upload.size > MAX_UPLOAD:
        raise ValidationError({field: "Файл больше 10 МБ."})
    try:
        img = Image.open(upload)
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValidationError({field: "Это не изображение."})
    if img.format not in ("JPEG", "PNG"):
        raise ValidationError({field: "Подходят только JPG и PNG."})

    rgba = ImageOps.exif_transpose(img).convert("RGBA")  # фото с телефона: поворот из EXIF
    img = Image.new("RGB", rgba.size, "white")  # прозрачный фон PNG -> белый
    img.paste(rgba, mask=rgba)
    img.thumbnail((max_side, max_side))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=90)  # пересохранение заодно стирает EXIF (геолокацию и т.п.)
    return ContentFile(buf.getvalue(), name=f"{uuid4().hex}.jpg")


def save_image(instance, field, upload):
    """Проверить файл и сохранить его в instance.<field>, удалив прежний файл."""
    content = prepare_image(upload, field)
    delete_image(instance, field, save=False)
    getattr(instance, field).save(content.name, content, save=True)


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
