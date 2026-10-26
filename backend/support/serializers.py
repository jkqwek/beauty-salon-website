from rest_framework import serializers
from .models import BugReport

class BugReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = BugReport
        fields = ["id", "contact", "text"]

    def validate_text(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Опишите проблему подробнее (минимум 10 символов).")
        return value