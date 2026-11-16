import datetime as dt
from decimal import Decimal as D
from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from bookings.models import Booking
from catalog.models import Employee, Service

from .exports import build_report_xlsx
from .models import Expense, StockItem
from .services import (
    cancellations, date_range, employee_workload, expenses_between, monthly_summary, parse_date, popular_services,
)

User = get_user_model()

OCT = dt.date(2026, 10, 12)  # понедельник
NOV = dt.date(2026, 11, 10)  # вторник


# ---------- помощники: если тесты падают на создании данных, правится только это место ----------

def make_service(name="Окрашивание", price="5000", **extra):
    return Service.objects.create(name=name, price=D(price), duration_minutes=60, category="Волосы", **extra)


def make_employee(name="Елена Ростова", **extra):
    return Employee.objects.create(full_name=name, specialization="Стилист", **extra)


def make_booking(service, employee, day, status="completed", price="5000", **extra):
    fields = dict(
        service=service, employee=employee, date=day,
        start_time=dt.time(10, 0), end_time=dt.time(11, 0),
        status=status, price=None if price is None else D(price),
    )
    fields.update(extra)
    booking = Booking(**fields)
    Booking.objects.bulk_create([booking])
    return booking


def at(day, hour, minute=0):
    return timezone.make_aware(dt.datetime.combine(day, dt.time(hour, minute)))


# ---------- разбор дат ----------

class DateParsingTests(SimpleTestCase):
    def test_parse_date(self):
        self.assertEqual(parse_date({"d": "2026-11-01"}, "d"), dt.date(2026, 11, 1))

    def test_missing_parameter_is_none(self):
        self.assertIsNone(parse_date({}, "d"))
        self.assertIsNone(parse_date({"d": ""}, "d"))

    def test_bad_format_raises(self):
        for bad in ("01.11.2026", "2026-13-01", "abc"):
            with self.subTest(value=bad):
                with self.assertRaises(ValidationError):
                    parse_date({"d": bad}, "d")

    def test_date_range(self):
        params = {"date_from": "2026-11-01", "date_to": "2026-11-30"}
        self.assertEqual(date_range(params), (dt.date(2026, 11, 1), dt.date(2026, 11, 30)))
        self.assertEqual(date_range({}), (None, None))

    def test_single_day_range_is_valid(self):
        params = {"date_from": "2026-11-10", "date_to": "2026-11-10"}
        self.assertEqual(date_range(params), (NOV, NOV))

    def test_reversed_range_raises(self):
        with self.assertRaises(ValidationError):
            date_range({"date_from": "2026-11-10", "date_to": "2026-11-01"})


# ---------- 109: какие услуги приносят больше денег ----------

class PopularServicesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.color = make_service("Окрашивание", "5000")
        cls.style = make_service("Укладка", "2500")
        cls.master = make_employee()
        make_booking(cls.color, cls.master, OCT, "completed", "5000")
        make_booking(cls.color, cls.master, NOV, "completed", "4500")  # по акции
        make_booking(cls.color, cls.master, NOV, "cancelled", "5000")  # деньгами не считается
        make_booking(cls.color, cls.master, NOV, "pending", "5000")  # ещё не выполнена
        make_booking(cls.style, cls.master, NOV, "completed", "2500")

    def test_only_completed_bookings_count(self):
        rows = {r["service_name"]: r for r in popular_services()}
        self.assertEqual(rows["Окрашивание"]["bookings_count"], 2)
        self.assertEqual(rows["Окрашивание"]["revenue"], D("9500"))
        self.assertEqual(rows["Укладка"]["revenue"], D("2500"))

    def test_revenue_uses_real_booking_price_not_current_service_price(self):
        # 4500 вместо 5000 у второй записи: скидка по акции уже зашита в цену записи
        self.assertEqual(popular_services()[0]["revenue"], D("9500"))

    def test_average_check_and_share(self):
        first, second = popular_services()
        self.assertEqual(first["avg_check"], D("4750.00"))
        self.assertEqual(second["avg_check"], D("2500.00"))
        self.assertEqual(first["share_percent"], 79.2)  # 9500 из 12000
        self.assertEqual(second["share_percent"], 20.8)

    def test_sorted_by_revenue_not_by_count(self):
        expensive = make_service("Сложное окрашивание", "9000")
        cheap = make_service("Дизайн ногтя", "1000")
        master = make_employee("Анна Лин")
        day = dt.date(2027, 1, 15)  # период, где нет других записей
        make_booking(expensive, master, day, "completed", "9000")
        for _ in range(3):
            make_booking(cheap, master, day, "completed", "1000")
        rows = popular_services(day, day)
        self.assertEqual([r["service_name"] for r in rows], ["Сложное окрашивание", "Дизайн ногтя"])
        self.assertEqual(rows[1]["bookings_count"], 3)

    def test_period_is_inclusive_on_both_ends(self):
        self.assertEqual(popular_services(NOV, NOV)[0]["revenue"], D("4500"))
        self.assertEqual(popular_services(None, dt.date(2026, 10, 31))[0]["revenue"], D("5000"))
        self.assertEqual(popular_services(dt.date(2026, 11, 1), None)[0]["revenue"], D("4500"))

    def test_empty_period_returns_empty_list(self):
        self.assertEqual(popular_services(dt.date(2030, 1, 1), dt.date(2030, 12, 31)), [])

    def test_booking_without_price_counts_as_zero_revenue(self):
        service = make_service("Старая услуга", "1000")
        day = dt.date(2027, 2, 1)
        make_booking(service, self.master, day, "completed", None)
        row = popular_services(day, day)[0]
        self.assertEqual(row["bookings_count"], 1)
        self.assertEqual(row["revenue"], D("0"))
        self.assertEqual(row["avg_check"], D("0.00"))
        self.assertEqual(row["share_percent"], 0)  # без деления на ноль

    def test_deleted_service_is_labelled(self):
        service = make_service("Снятая с продажи", "1000")
        service.deleted_at = timezone.now()
        service.save()
        day = dt.date(2027, 3, 1)
        make_booking(service, self.master, day, "completed", "1000")
        self.assertEqual(popular_services(day, day)[0]["service_name"], "Снятая с продажи (удалена)")


# ---------- 110: отмены и потерянная выручка ----------

class CancellationsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.color = make_service("Окрашивание", "5000")
        cls.style = make_service("Укладка", "2500")
        cls.master = make_employee("Елена Ростова")
        cls.other = make_employee("Анна Лин")
        make_booking(cls.color, cls.master, OCT, "cancelled", "4500")
        make_booking(cls.style, cls.other, NOV, "cancelled", None)  # цены нет: берётся цена услуги, 2500
        make_booking(cls.color, cls.master, NOV, "completed", "5000")
        make_booking(cls.style, cls.master, OCT, "pending", "2500")

    def test_totals(self):
        data = cancellations()
        self.assertEqual(data["bookings_total"], 4)
        self.assertEqual(data["cancelled_count"], 2)
        self.assertEqual(data["cancel_rate"], 50.0)
        self.assertEqual(data["lost_revenue"], D("7000"))

    def test_missing_price_falls_back_to_service_price(self):
        by_service = {r["service_name"]: r for r in cancellations()["by_service"]}
        self.assertEqual(by_service["Укладка"]["lost_revenue"], D("2500"))

    def test_breakdown_is_sorted_by_lost_revenue(self):
        data = cancellations()
        self.assertEqual([r["service_name"] for r in data["by_service"]], ["Окрашивание", "Укладка"])
        self.assertEqual([r["employee_name"] for r in data["by_employee"]], ["Елена Ростова", "Анна Лин"])
        self.assertEqual(data["by_employee"][0]["lost_revenue"], D("4500"))

    def test_period_limits_both_total_and_cancelled(self):
        november = cancellations(dt.date(2026, 11, 1), None)
        self.assertEqual(november["bookings_total"], 2)
        self.assertEqual(november["cancelled_count"], 1)
        self.assertEqual(november["lost_revenue"], D("2500"))
        october = cancellations(None, dt.date(2026, 10, 31))
        self.assertEqual(october["cancelled_count"], 1)
        self.assertEqual(october["lost_revenue"], D("4500"))

    def test_no_cancellations(self):
        data = cancellations(dt.date(2030, 1, 1), dt.date(2030, 12, 31))
        self.assertEqual(data["bookings_total"], 0)
        self.assertEqual(data["cancelled_count"], 0)
        self.assertEqual(data["cancel_rate"], 0)  # без деления на ноль
        self.assertEqual(data["lost_revenue"], D("0"))
        self.assertEqual(data["by_service"], [])


# ---------- по месяцам, загрузка мастеров, расходы ----------

class MonthlySummaryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        service, master = make_service(), make_employee()
        make_booking(service, master, dt.date(2026, 10, 5), "completed", "5000")
        make_booking(service, master, dt.date(2026, 10, 20), "completed", "4500")
        make_booking(service, master, dt.date(2026, 10, 25), "pending", "5000")  # не считается
        make_booking(service, master, dt.date(2026, 12, 3), "cancelled", "5000")  # месяц без денег
        Expense.objects.create(category="Аренда", amount=D("3000"), date=dt.date(2026, 10, 1))
        Expense.objects.create(category="Материалы", amount=D("1200.50"), date=dt.date(2026, 11, 3))

    def test_revenue_and_expenses_by_month(self):
        rows = monthly_summary()
        self.assertEqual(rows[0], {"month": dt.date(2026, 10, 1), "revenue": D("9500"), "expenses": D("3000")})

    def test_month_with_only_expenses_is_included(self):
        self.assertEqual(monthly_summary()[1], {"month": dt.date(2026, 11, 1), "revenue": D("0"), "expenses": D("1200.50")})

    def test_month_without_revenue_and_expenses_is_absent(self):
        self.assertEqual([r["month"] for r in monthly_summary()], [dt.date(2026, 10, 1), dt.date(2026, 11, 1)])

    def test_period_filter(self):
        rows = monthly_summary(dt.date(2026, 11, 1), None)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["expenses"], D("1200.50"))


class EmployeeWorkloadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        service = make_service()
        cls.master = make_employee("Елена Ростова")
        cls.other = make_employee("Анна Лин")
        # 1 час по плану, фактически 1 час
        make_booking(service, cls.master, NOV, "completed", "5000", actual_start=at(NOV, 10), actual_end=at(NOV, 11))
        # 1,5 часа по плану, отметок времени нет
        make_booking(service, cls.master, NOV, "completed", "2500", start_time=dt.time(12, 0), end_time=dt.time(13, 30))
        make_booking(service, cls.master, NOV, "cancelled", "9999")  # в расчёт не входит
        make_booking(service, cls.other, NOV, "completed", "2500")

    def test_planned_actual_hours_and_revenue(self):
        rows = {r["employee_name"]: r for r in employee_workload()}
        master = rows["Елена Ростова"]
        self.assertEqual(master["bookings_count"], 2)
        self.assertEqual(master["planned_hours"], 2.5)
        self.assertEqual(master["actual_hours"], 1.0)  # запись без отметок времени в факт не попадает
        self.assertEqual(master["revenue"], D("7500"))

    def test_employee_without_tracking_has_zero_actual_hours(self):
        rows = {r["employee_name"]: r for r in employee_workload()}
        self.assertEqual(rows["Анна Лин"]["actual_hours"], 0)

    def test_sorted_by_name(self):
        self.assertEqual([r["employee_name"] for r in employee_workload()], ["Анна Лин", "Елена Ростова"])


class ExpensesBetweenTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for day, amount in ((dt.date(2026, 10, 1), "3000"), (dt.date(2026, 11, 3), "1200.50"), (dt.date(2026, 11, 20), "500")):
            Expense.objects.create(category="Прочее", amount=D(amount), date=day)

    def test_period_is_inclusive_and_ordered_by_date(self):
        items = expenses_between(dt.date(2026, 11, 3), dt.date(2026, 11, 20))
        self.assertEqual([e.amount for e in items], [D("1200.50"), D("500")])

    def test_without_period_returns_everything(self):
        self.assertEqual(len(expenses_between()), 3)


# ---------- API ----------

FINANCE_ENDPOINTS = [
    "/api/finance/popular-services/",
    "/api/finance/cancellations/",
    "/api/finance/revenue-report/",
    "/api/finance/employee-workload/",
    "/api/finance/imcome-summary/",  # если исправишь опечатку «imcome», поменяй и здесь
    "/api/finance/earnings/",
    "/api/finance/master-payout/",
    "/api/finance/weekday-revenue/",
    "/api/finance/export/",
    "/api/finance/expenses/",
    "/api/finance/stock/",
]


class FinanceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("finance_admin", password="x", is_staff=True)
        cls.user = User.objects.create_user("finance_client", password="x")

        cls.color = make_service("Окрашивание", "5000")
        cls.style = make_service("Укладка", "2500")
        cls.master = make_employee("Елена Ростова")
        cls.master.commission_percent = D("40")
        cls.master.save()
        cls.other = make_employee("Анна Лин")
        cls.other.commission_percent = D("30")
        cls.other.save()

        make_booking(cls.color, cls.master, OCT, "completed", "5000")
        make_booking(cls.color, cls.master, NOV, "completed", "4500")
        make_booking(cls.style, cls.other, NOV, "completed", "2500")
        make_booking(cls.color, cls.master, NOV, "cancelled", "4500")
        Expense.objects.create(category="Аренда", amount=D("3000"), date=dt.date(2026, 10, 5))
        Expense.objects.create(category="Материалы", amount=D("1200.50"), date=dt.date(2026, 11, 3))

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    # --- права доступа ---

    def test_anonymous_gets_401(self):
        for url in FINANCE_ENDPOINTS:
            with self.subTest(url=url):
                self.assertEqual(APIClient().get(url).status_code, 401)

    def test_regular_user_gets_403(self):
        client = APIClient()
        client.force_authenticate(self.user)
        for url in FINANCE_ENDPOINTS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 403)

    def test_admin_gets_200(self):
        for url in FINANCE_ENDPOINTS:
            with self.subTest(url=url):
                self.assertEqual(self.api.get(url).status_code, 200)

    # --- проверка дат ---

    def test_bad_date_returns_400_with_field_error(self):
        for url in ("/api/finance/popular-services/", "/api/finance/cancellations/", "/api/finance/export/"):
            with self.subTest(url=url):
                response = self.api.get(url, {"date_from": "2026-13-01"})
                self.assertEqual(response.status_code, 400)
                self.assertIn("date_from", response.json()["errors"])

    def test_reversed_period_returns_400(self):
        response = self.api.get("/api/finance/popular-services/", {"date_from": "2026-11-10", "date_to": "2026-11-01"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("date_to", response.json()["errors"])

    # --- отчёты ---

    def test_popular_services_response(self):
        data = self.api.get("/api/finance/popular-services/").json()
        self.assertEqual(D(data["total_revenue"]), D("12000"))
        first = data["results"][0]
        self.assertEqual(first["service_name"], "Окрашивание")
        self.assertEqual(D(first["revenue"]), D("9500"))
        self.assertEqual(first["bookings_count"], 2)

    def test_cancellations_response(self):
        data = self.api.get("/api/finance/cancellations/").json()
        self.assertEqual(data["cancelled_count"], 1)
        self.assertEqual(data["bookings_total"], 4)
        self.assertEqual(data["cancel_rate"], 25.0)
        self.assertEqual(D(data["lost_revenue"]), D("4500"))

    def test_income_summary(self):
        data = self.api.get("/api/finance/imcome-summary/").json()
        self.assertEqual(D(data["total_income"]), D("12000"))
        self.assertEqual(data["bookings_count"], 3)

    def test_income_summary_for_period(self):
        data = self.api.get("/api/finance/imcome-summary/", {"date_from": "2026-11-01"}).json()
        self.assertEqual(D(data["total_income"]), D("7000"))
        self.assertEqual(data["bookings_count"], 2)

    def test_earnings_profit_is_revenue_minus_expenses(self):
        data = self.api.get("/api/finance/earnings/").json()
        self.assertEqual(D(data["revenue"]), D("12000"))
        self.assertEqual(D(data["expenses"]), D("4200.50"))
        self.assertEqual(D(data["profit"]), D("7799.50"))

    def test_earnings_for_period(self):
        data = self.api.get("/api/finance/earnings/", {"date_from": "2026-11-01", "date_to": "2026-11-30"}).json()
        self.assertEqual(D(data["revenue"]), D("7000"))
        self.assertEqual(D(data["expenses"]), D("1200.50"))
        self.assertEqual(D(data["profit"]), D("5799.50"))

    def test_revenue_report_by_month(self):
        rows = self.api.get("/api/finance/revenue-report/", {"group_by": "month"}).json()
        self.assertEqual([r["period"] for r in rows], ["2026-10-01", "2026-11-01"])
        self.assertEqual(D(rows[0]["profit"]), D("2000"))  # 5000 - 3000
        self.assertEqual(D(rows[1]["profit"]), D("5799.50"))  # 7000 - 1200.50

    def test_revenue_report_rejects_unknown_grouping(self):
        self.assertEqual(self.api.get("/api/finance/revenue-report/", {"group_by": "year"}).status_code, 400)

    def test_master_payout_uses_commission_percent(self):
        rows = {r["employee_name"]: r for r in self.api.get("/api/finance/master-payout/").json()}
        master, other = rows["Елена Ростова"], rows["Анна Лин"]
        self.assertEqual(D(master["revenue"]), D("9500"))
        self.assertEqual(D(master["payout"]), D("3800"))  # 40%
        self.assertEqual(D(master["salon_share"]), D("5700"))
        self.assertEqual(D(other["payout"]), D("750"))  # 30% от 2500

    def test_weekday_revenue_has_seven_days(self):
        rows = self.api.get("/api/finance/weekday-revenue/").json()
        self.assertEqual(len(rows), 7)
        by_day = {r["weekday"]: D(r["revenue"]) for r in rows}
        self.assertEqual(by_day[OCT.isoweekday()], D("5000"))
        self.assertEqual(by_day[NOV.isoweekday()], D("7000"))
        self.assertEqual(sum(by_day.values()), D("12000"))

    # --- калькулятор цены со скидкой ---

    def test_price_calculation(self):
        data = self.api.get("/api/finance/price-calculation/", {"service_id": self.color.pk, "discount": "15"}).json()
        self.assertEqual(D(data["discount_amount"]), D("750"))
        self.assertEqual(D(data["final_price"]), D("4250"))

    def test_price_calculation_is_available_to_regular_users(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/finance/price-calculation/", {"service_id": self.color.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(D(response.json()["final_price"]), D("5000"))  # скидка по умолчанию 0

    def test_price_calculation_rejects_bad_input(self):
        url = "/api/finance/price-calculation/"
        cases = (
            {},  # нет услуги
            {"service_id": self.color.pk, "discount": "101"},
            {"service_id": self.color.pk, "discount": "-5"},
            {"service_id": self.color.pk, "discount": "abc"},
            {"service_id": self.color.pk, "discount": "NaN"},
        )
        for params in cases:
            with self.subTest(params=params):
                self.assertEqual(self.api.get(url, params).status_code, 400)

    def test_price_calculation_unknown_or_inactive_service_is_404(self):
        inactive = make_service("Не продаётся", "1000", is_active=False)
        for service_id in (inactive.pk, 999999):
            with self.subTest(service_id=service_id):
                self.assertEqual(self.api.get("/api/finance/price-calculation/", {"service_id": service_id}).status_code, 404)

    # --- выгрузка ---

    def test_export_returns_xlsx_with_period_in_filename(self):
        response = self.api.get("/api/finance/export/", {"date_from": "2026-11-01", "date_to": "2026-11-30"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])
        self.assertIn("allure-finance-2026-11-01_2026-11-30.xlsx", response["Content-Disposition"])
        self.assertEqual(load_workbook(BytesIO(response.content)).sheetnames[0], "Выручка и расходы")


# ---------- Excel-выгрузка ----------

class ExportTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        color, style = make_service("Окрашивание", "5000"), make_service("Укладка", "2500")
        master = make_employee()
        make_booking(color, master, OCT, "completed", "5000")
        make_booking(color, master, NOV, "completed", "4500")
        make_booking(style, master, NOV, "completed", "2500")
        Expense.objects.create(category="Аренда", amount=D("3000"), date=dt.date(2026, 10, 5))
        Expense.objects.create(category="Материалы", amount=D("1200.50"), date=dt.date(2026, 11, 3))

    def book(self, d_from=None, d_to=None):
        return load_workbook(BytesIO(build_report_xlsx(d_from, d_to)))

    def test_sheets(self):
        self.assertEqual(
            self.book().sheetnames,
            ["Выручка и расходы", "Услуги", "Мастера", "Отмены по услугам", "Отмены по мастерам", "Расходы"],
        )

    def test_monthly_sheet_values_and_formulas(self):
        ws = self.book()["Выручка и расходы"]
        self.assertEqual([c.value for c in ws[4]], ["Месяц", "Выручка", "Расходы", "Прибыль"])
        self.assertEqual(ws["A5"].value, "10.2026")
        self.assertEqual(ws["B5"].value, 5000)
        self.assertEqual(ws["C5"].value, 3000)
        self.assertEqual(ws["D5"].value, "=B5-C5")  # прибыль — формула, а не готовое число
        self.assertEqual(ws["D6"].value, "=B6-C6")
        self.assertEqual(ws["A7"].value, "Итого")
        self.assertEqual(ws["B7"].value, "=SUM(B5:B6)")

    def test_money_is_stored_as_numbers(self):
        ws = self.book()["Услуги"]
        for cell in (ws["B5"], ws["C5"], ws["D5"]):
            self.assertIsInstance(cell.value, (int, float))  # суммируется в Excel, а не строка
        self.assertIn("₽", ws["C5"].number_format)

    def test_services_sheet_is_sorted_by_revenue_with_share(self):
        ws = self.book()["Услуги"]
        self.assertEqual(ws["A5"].value, "Окрашивание")
        self.assertEqual(ws["B5"].value, 2)
        self.assertEqual(ws["C5"].value, 9500)
        self.assertAlmostEqual(ws["E5"].value, 0.792, places=3)  # доля хранится как 0.792 и показывается как 79,2%
        self.assertEqual(ws["A6"].value, "Укладка")
        self.assertEqual(ws["B7"].value, "=SUM(B5:B6)")

    def test_period_is_written_to_sheet(self):
        ws = self.book(dt.date(2026, 11, 1), dt.date(2026, 11, 30))["Услуги"]
        self.assertEqual(ws["A2"].value, "Период: 01.11.2026 — 30.11.2026")
        self.assertEqual(ws["C5"].value, 4500)  # в ноябре окрашивание принесло только 4500

    def test_empty_period_does_not_break_the_file(self):
        wb = self.book(dt.date(2030, 1, 1), dt.date(2030, 12, 31))
        for name in wb.sheetnames:
            with self.subTest(sheet=name):
                self.assertEqual(wb[name]["A5"].value, "За выбранный период данных нет")

    def test_text_starting_with_equals_sign_is_not_a_formula(self):
        Expense.objects.create(category="Прочее", amount=D("100"), date=dt.date(2027, 1, 10), description="=1+1")
        ws = self.book(dt.date(2027, 1, 1), dt.date(2027, 1, 31))["Расходы"]
        self.assertEqual(ws["D5"].value, "=1+1")
        self.assertEqual(ws["D5"].data_type, "s")  # строка, Excel её не вычислит


# ---------- склад (задача 107) ----------

class StockItemModelTests(SimpleTestCase):
    def test_is_low_when_quantity_at_or_below_minimum(self):
        item = StockItem(name="Краска", category="consumables", quantity=5, min_quantity=5)
        self.assertTrue(item.is_low)  # ровно на пороге: пора заказывать
        item.quantity = 2
        self.assertTrue(item.is_low)
        item.quantity = 6
        self.assertFalse(item.is_low)


class StockApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user("stock_admin", password="x", is_staff=True)
        cls.item = StockItem.objects.create(name="Гель-лак", category="consumables", quantity=3, min_quantity=5)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_list_contains_is_low_flag(self):
        row = self.api.get("/api/finance/stock/").json()[0]
        self.assertTrue(row["is_low"])

    def test_quantity_can_be_updated(self):
        response = self.api.patch(f"/api/finance/stock/{self.item.pk}/", {"quantity": 10}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["is_low"])

    def test_negative_quantity_is_rejected(self):
        response = self.api.patch(f"/api/finance/stock/{self.item.pk}/", {"quantity": -1}, format="json")
        self.assertEqual(response.status_code, 400)
