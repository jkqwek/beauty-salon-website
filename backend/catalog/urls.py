from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import EmployeeViewSet, ServiceViewSet, public_promotions

router = DefaultRouter()
router.register("services", ServiceViewSet)
router.register("employees", EmployeeViewSet)

urlpatterns = router.urls + [path("promotions/", public_promotions, name="public-promotions")]