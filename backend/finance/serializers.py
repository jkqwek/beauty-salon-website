from rest_framework import serializers
from .models import Expense, StockItem

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = "__all__"

class StockItemSerializer(serializers.ModelSerializer):
    is_low = serializers.BooleanField(read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = StockItem
        fields = "__all__"
