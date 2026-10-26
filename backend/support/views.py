from rest_framework import generics, permissions
from .models import BugReport
from .serializers import BugReportSerializer

class BugReportCreateView(generics.CreateAPIView):
    queryset = BugReport.objects.all()
    serializer_class = BugReportSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)