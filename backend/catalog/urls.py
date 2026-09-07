from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, EmployeeViewSet

router = DefaultRouter()
router.register("services", ServiceViewSet)
router.register("employees", EmployeeViewSet)

urlpatterns = router.urls