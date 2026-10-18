"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import AdminUserViewSet, RegisterView, me, me_avatar, me_bonus, change_password, password_reset, password_reset_confirm
from bookings.views import (
    AdminBookingViewSet, AdminReviewViewSet, SalonClosureViewSet, ScheduleViewSet, TimeOffViewSet,
    panel_counters, public_reviews, salon_load, today_stats,
)
from catalog.views import PromotionViewSet

# панель управления на сайте (только сотрудники)
admin_router = SimpleRouter()
admin_router.register("users", AdminUserViewSet, basename="admin-users")
admin_router.register("bookings", AdminBookingViewSet, basename="admin-bookings")
admin_router.register("schedules", ScheduleViewSet, basename="admin-schedules")
admin_router.register("time-offs", TimeOffViewSet, basename="admin-time-offs")
admin_router.register("reviews", AdminReviewViewSet, basename="admin-reviews")
admin_router.register("closures", SalonClosureViewSet, basename="admin-closures")
admin_router.register("promotions", PromotionViewSet, basename="admin-promotions")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("catalog.urls")),
    path("api/bookings/", include("bookings.urls")),
    
    path("api/auth/register/", RegisterView.as_view(), name="register"),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/auth/me/", me, name="me"),
    path("api/auth/me/avatar/", me_avatar, name="me-avatar"),
    path("api/auth/me/bonus/", me_bonus, name="me-bonus"),
    path("api/auth/change-password/", change_password, name="change-password"),
    path("api/auth/password-reset/", password_reset, name="password-reset"),
    path("api/auth/password-reset/confirm/", password_reset_confirm, name="password-reset-confirm"),
    path("api/admin/load/", salon_load, name="salon-load"),
    path("api/admin/counters/", panel_counters, name="panel-counters"),
    path("api/admin/stats/today/", today_stats, name="today-stats"),
    path("api/reviews/", public_reviews, name="public-reviews"),
    path("api/admin/", include(admin_router.urls)),
    
    path("api/finance/", include("finance.urls")),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
