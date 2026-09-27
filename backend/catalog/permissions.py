from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    """Сотрудник (is_staff). Статусов всего два: покупатель и сотрудник с полными правами."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
