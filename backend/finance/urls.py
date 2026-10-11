from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ExpenseViewSet, StockItemViewSet, imcome_summary, revenue_report, employee_workload_report

router = DefaultRouter()
router.register("expenses", ExpenseViewSet)
router.register("stock", StockItemViewSet)
urlpatterns = [
    path("", include(router.urls)),
    path("imcome-summary/", imcome_summary, name="imcome_summary"),
    path("revenue-report/", revenue_report, name="revenue_report"),
    path("employee-workload/", employee_workload_report, name="employee-workload"),
]