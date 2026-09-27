from rest_framework import serializers
from .models import Expense, StockItem

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = "__all__"

class StockItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockItem
        fields = "__all__"
