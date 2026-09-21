import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def _messages(value):
    if isinstance(value, dict):
        return [m for v in value.values() for m in _messages(v)]
    if isinstance(value, (list, tuple)):
        return [m for v in value for m in _messages(v)]
    return [str(value)]


def custom_exception_handler(exc, context):
    """Формат: {"detail": "...", "code": "...", "errors": {"поле": ["..."]}}"""
    response = exception_handler(exc, context)

    # Непредвиденная ошибка: отдаём JSON вместо HTML-страницы
    if response is None:
        logger.exception("Необработанная ошибка в %s", context.get("view"))
        return Response(
            {"detail": "Внутренняя ошибка сервера. Попробуйте позже.", "code": "server_error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    data = response.data
    if response.status_code == status.HTTP_400_BAD_REQUEST:
        errors = {"non_field_errors": _messages(data)} if isinstance(data, list) else {
            field: _messages(value) for field, value in data.items()
        }
        non_field = errors.get("non_field_errors")
        response.data = {
            "detail": non_field[0] if non_field else "Проверьте правильность заполнения полей.",
            "code": "validation_error",
            "errors": errors,
        }
    elif isinstance(data, dict):
        data.setdefault("code", getattr(exc, "default_code", "error"))

    return response