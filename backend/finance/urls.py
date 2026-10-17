from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ExpenseViewSet, StockItemViewSet, imcome_summary, revenue_report, employee_workload_report, price_calculation, earnings_report, master_payout_report, weekday_revenue_report

router = DefaultRouter()
router.register("expenses", ExpenseViewSet)
router.register("stock", StockItemViewSet)
urlpatterns = [
    path("", include(router.urls)),
    path("imcome-summary/", imcome_summary, name="imcome_summary"),
    path("revenue-report/", revenue_report, name="revenue_report"),
    path("employee-workload/", employee_workload_report, name="employee-workload"),
    path("price-calculation/", price_calculation, name="price-calculation"),
    path("earnings/", earnings_report, name="earnings-report"),
    path("master-payout/", master_payout_report, name="master-payout"),
    path("weekday-revenue/", weekday_revenue_report, name="weekday-revenue"),
]