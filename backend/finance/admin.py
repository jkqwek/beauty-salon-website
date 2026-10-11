from django.contrib import admin
from .models import StockItem


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "quantity", "unit", "min_quantity", "is_low")
    list_editable = ("quantity",)  # приход/списание прямо из списка
    list_filter = ("category",)
    search_fields = ("name",)

    @admin.display(boolean=True, description="Заканчивается")
    def is_low(self, obj):
        return obj.quantity <= obj.min_quantity
