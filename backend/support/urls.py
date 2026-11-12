from django.urls import path
from .views import BugReportCreateView

urlpatterns = [
    path("", BugReportCreateView.as_view(), name="bug-report-create"),
]