from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .services import (
    cancellations, employee_workload, expenses_between, monthly_summary, popular_services,
)

MONEY = '#,##0.00 "₽"'
HEAD_ROW = 4
FIRST_ROW = HEAD_ROW + 1

BOLD = Font(bold=True)
GREY = Font(color="6B6B6B", size=10)
HEAD_FILL = PatternFill("solid", fgColor="FAEDF0")
HEAD_BORDER = Border(bottom=Side(style="medium", color="D4AF37"))


class Formula(str):
    """Строка, которую нужно записать как формулу Excel (обычный текст формулой не становится)."""


def _period_text(d_from, d_to):
    if d_from and d_to:
        return f"Период: {d_from:%d.%m.%Y} — {d_to:%d.%m.%Y}"
    if d_from:
        return f"Период: с {d_from:%d.%m.%Y}"
    if d_to:
        return f"Период: по {d_to:%d.%m.%Y}"
    return "Период: всё время"


def _write_sheet(wb, name, title, note, headers, rows, formats=None, total=(), widths=()):
    """Лист: заголовок, период, шапка таблицы, строки и (по желанию) итоговая строка с формулами SUM."""
    formats = formats or {}
    ws = wb.create_sheet(name)
    ws["A1"] = title
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = note
    ws["A2"].font = GREY

    for col, text in enumerate(headers, 1):
        cell = ws.cell(HEAD_ROW, col, text)
        cell.font, cell.fill, cell.border = BOLD, HEAD_FILL, HEAD_BORDER
        cell.alignment = Alignment(vertical="center", wrap_text=True)

    for r, row in enumerate(rows, FIRST_ROW):
        for col, value in enumerate(row, 1):
            cell = ws.cell(r, col, value)
            if isinstance(value, str) and not isinstance(value, Formula):
                cell.data_type = "s"
            if col in formats:
                cell.number_format = formats[col]

    if not rows:
        ws.cell(FIRST_ROW, 1, "За выбранный период данных нет").font = GREY
    elif total:
        last = FIRST_ROW + len(rows) - 1
        ws.cell(last + 1, 1, "Итого").font = BOLD
        for col in total:
            letter = get_column_letter(col)
            cell = ws.cell(last + 1, col, f"=SUM({letter}{FIRST_ROW}:{letter}{last})")
            cell.font = BOLD
            if col in formats:
                cell.number_format = formats[col]

    for col, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col)].width = width
    ws.freeze_panes = ws.cell(FIRST_ROW, 1)


def build_report_xlsx(d_from=None, d_to=None) -> bytes:
    period = _period_text(d_from, d_to)
    wb = Workbook()
    wb.remove(wb.active)

    # 1. Выручка, расходы и прибыль по месяцам. Прибыль — формула/
    months = monthly_summary(d_from, d_to)
    _write_sheet(
        wb, "Выручка и расходы", "Выручка, расходы и прибыль по месяцам", period,
        ["Месяц", "Выручка", "Расходы", "Прибыль"],
        [[f"{m['month']:%m.%Y}", m["revenue"], m["expenses"], Formula(f"=B{r}-C{r}")]
         for r, m in enumerate(months, FIRST_ROW)],
        formats={2: MONEY, 3: MONEY, 4: MONEY}, total=(2, 3, 4), widths=(14, 18, 18, 18),
    )

    # 2. Какие услуги приносят больше денег
    _write_sheet(
        wb, "Услуги", "Услуги по выручке", period,
        ["Услуга", "Записей", "Выручка", "Средний чек", "Доля выручки"],
        [[s["service_name"], s["bookings_count"], s["revenue"], s["avg_check"], s["share_percent"] / 100]
         for s in popular_services(d_from, d_to)],
        formats={2: "0", 3: MONEY, 4: MONEY, 5: "0.0%"}, total=(2, 3), widths=(38, 12, 18, 16, 16),
    )

    # 3. Загрузка мастеров
    _write_sheet(
        wb, "Мастера", "Загрузка мастеров", period,
        ["Мастер", "Записей", "Часов (план)", "Часов (факт)", "Выручка"],
        [[w["employee_name"], w["bookings_count"], w["planned_hours"], w["actual_hours"], w["revenue"]]
         for w in employee_workload(d_from, d_to)],
        formats={2: "0", 3: "0.0", 4: "0.0", 5: MONEY}, total=(2, 3, 4, 5), widths=(30, 12, 16, 16, 18),
    )

    # 4–5. Отмены и потенциально потерянная выручка
    cancelled = cancellations(d_from, d_to)
    note = (
        f"{period}. Отменено {cancelled['cancelled_count']} из {cancelled['bookings_total']} записей "
        f"({cancelled['cancel_rate']}%). Потеря потенциальная: освободившееся время мог занять другой клиент."
    )
    _write_sheet(
        wb, "Отмены по услугам", "Отменённые записи по услугам", note,
        ["Услуга", "Отмен", "Потеряно"],
        [[r["service_name"], r["cancelled_count"], r["lost_revenue"]] for r in cancelled["by_service"]],
        formats={2: "0", 3: MONEY}, total=(2, 3), widths=(38, 12, 18),
    )
    _write_sheet(
        wb, "Отмены по мастерам", "Отменённые записи по мастерам", note,
        ["Мастер", "Отмен", "Потеряно"],
        [[r["employee_name"], r["cancelled_count"], r["lost_revenue"]] for r in cancelled["by_employee"]],
        formats={2: "0", 3: MONEY}, total=(2, 3), widths=(30, 12, 18),
    )

    # 6. Список расходов
    _write_sheet(
        wb, "Расходы", "Расходы", period,
        ["Дата", "Категория", "Сумма", "Описание"],
        [[e.date, e.category, e.amount, e.description] for e in expenses_between(d_from, d_to)],
        formats={1: "DD.MM.YYYY", 3: MONEY}, total=(3,), widths=(14, 24, 18, 50),
    )

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()