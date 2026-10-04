from django.shortcuts import render
from .models import Expense, StockItem
from catalog.permissions import IsAdminUser
from .serializers import ExpenseSerializer, StockItemSerializer
from catalog.models import Employee

from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes

from bookings.models import Booking
from rest_framework.response import Response
from django.db.models import Sum, Count, F, ExpressionWrapper, DurationField
from datetime import datetime

from django.db.models.functions import TruncDay, TruncWeek, TruncMonth

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.all()
    permission_classes = [IsAdminUser]
    serializer_class = ExpenseSerializer


class StockItemViewSet(viewsets.ModelViewSet):
    queryset = StockItem.objects.all()
    permission_classes = [IsAdminUser]
    serializer_class = StockItemSerializer
    
@api_view(["GET"])
@permission_classes([IsAdminUser])
def imcome_summary(request):
    bookings = Booking.objects.filter(status="completed")
    date_from_str = request.query_params.get("date_from")
    date_to_str = request.query_params.get("date_to")
    
    if date_from_str:
        try:
            date_from = datetime.strptime(date_from_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"error": "date_from должен быть в формате ГГГГ-ММ-ДД"},
                status=400,
            )
        bookings = bookings.filter(date__gte=date_from)
    
    if date_to_str:
            try:
                date_to = datetime.strptime(date_to_str, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "date_to должен быть в формате ГГГГ-ММ-ДД"},
                    status=400,
                )
            bookings = bookings.filter(date__lte=date_to)
    
    total = bookings.aggregate(total_income=Sum("price"))["total_income"] or 0
    
    return Response({
        "total_income": str(total),
        "bookings_count": bookings.count(),
    })

TRUNC_FUNCTIONS = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
}

@api_view(["GET"])
@permission_classes([IsAdminUser])
def revenue_report(request):
    group_by = request.query_params.get("group_by", "day")
    if group_by not in TRUNC_FUNCTIONS:
        return Response(
            {"error": "group_by должен быть одним из: day, week, month"},
            status=400,
        )
    bookings = Booking.objects.filter(status="completed")
    
    date_from_str = request.query_params.get("date_from")
    date_to_str = request.query_params.get("date_to")
    
    if date_from_str:
        try:
            date_from = datetime.strptime(date_from_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "date_from должен быть в формате ГГГГ-ММ-ДД"}, status=400)
        bookings = bookings.filter(date__gte=date_from)

    if date_to_str:
        try:
            date_to = datetime.strptime(date_to_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "date_to должен быть в формате ГГГГ-ММ-ДД"}, status=400)
        bookings = bookings.filter(date__lte=date_to)
    
    trunc_func = TRUNC_FUNCTIONS[group_by]
    revenue_rows = (
        bookings
        .annotate(period=trunc_func("date"))
        .values("period")
        .annotate(revenue=Sum("price"))
        .order_by("period")
    )
    
    expenses = Expense.objects.all()
    if date_from_str:
        expenses = expenses.filter(date__gte=date_from)
    if date_to_str:
        expenses = expenses.filter(date__lte=date_to)

    expense_rows = (
        expenses
        .annotate(period=trunc_func("date"))
        .values("period")
        .annotate(total=Sum("amount"))
    )
    expenses_by_period = {row["period"]: row["total"] for row in expense_rows}
    
    result = []
    for row in revenue_rows:
        period = row["period"]
        revenue = row["revenue"] or 0
        expense = expenses_by_period.get(period, 0)
        result.append({
            "period": period.strftime("%Y-%m-%d"),
            "revenue": str(revenue),
            "expenses": str(expense),
            "profit": str(revenue - expense),
        })

    return Response(result)

@api_view(["GET"])
@permission_classes([IsAdminUser])
def employee_workload_report(request):
    bookings = Booking.objects.filter(status="completed")

    date_from_str = request.query_params.get("date_from")
    date_to_str = request.query_params.get("date_to")

    if date_from_str:
        try:
            date_from = datetime.strptime(date_from_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "date_from должен быть в формате ГГГГ-ММ-ДД"}, status=400)
        bookings = bookings.filter(date__gte=date_from)

    if date_to_str:
        try:
            date_to = datetime.strptime(date_to_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "date_to должен быть в формате ГГГГ-ММ-ДД"}, status=400)
        bookings = bookings.filter(date__lte=date_to)

    duration_expr = ExpressionWrapper(
        F("end_time") - F("start_time"), output_field=DurationField()
    )
    # фактическое время из тайм-трекинга; записи без отметок в сумму не попадают (NULL)
    actual_expr = ExpressionWrapper(
        F("actual_end") - F("actual_start"), output_field=DurationField()
    )

    rows = (
        bookings
        .annotate(duration=duration_expr, actual_duration=actual_expr)
        .values("employee_id", "employee__full_name")
        .annotate(
            bookings_count=Count("id"),
            total_revenue=Sum("price"),
            total_duration=Sum("duration"),
            total_actual=Sum("actual_duration"),
        )
        .order_by("employee")
    )

    result = []
    for row in rows:
        total_seconds = row["total_duration"].total_seconds() if row["total_duration"] else 0
        actual_seconds = row["total_actual"].total_seconds() if row["total_actual"] else 0
        result.append({
            "employee_id": row["employee_id"],
            "employee_name": row["employee__full_name"],
            "bookings_count": row["bookings_count"],
            "total_hours": round(total_seconds / 3600, 1),
            "actual_hours": round(actual_seconds / 3600, 1),
            "total_revenue": str(row["total_revenue"] or 0),
        })

    return Response(result)