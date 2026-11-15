"""Чек в PDF (заглушка). Это информационный документ, а не кассовый чек (54-ФЗ)."""
from decimal import Decimal
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.platypus.flowables import HRFlowable

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
FONT_FILES = {
    "Receipt": "DejaVuSans.ttf",
    "Receipt-Bold": "DejaVuSans-Bold.ttf",
    "Receipt-Serif": "DejaVuSerif.ttf",
}

SALON_NAME = "Allure"
SALON_SUBTITLE = "Beauty Salon"
SALON_CONTACT = ""

GOLD = colors.HexColor("#B8923A")
GOLD_LIGHT = colors.HexColor("#D4AF37")
TEXT = colors.HexColor("#2B2B2B")
MUTED = colors.HexColor("#6B6B6B")
LINE = colors.HexColor("#D9C79A")

_fonts_ready = False


def _register_fonts():
    global _fonts_ready
    if _fonts_ready:
        return
    for name, file in FONT_FILES.items():
        path = FONT_DIR / file
        if not path.exists():
            raise FileNotFoundError(f"Не найден шрифт {path}. Положите файлы {', '.join(FONT_FILES.values())} в {FONT_DIR}.")
        pdfmetrics.registerFont(TTFont(name, str(path)))
    pdfmetrics.registerFontFamily("Receipt", normal="Receipt", bold="Receipt-Bold")
    _fonts_ready = True


def money(value):
    """2500 -> «2 500,00 ₽» (неразрывные пробелы, чтобы сумма не переносилась по строкам)."""
    text = f"{Decimal(value or 0):,.2f}".replace(",", "\u00a0").replace(".", ",")
    return f"{text}\u00a0₽"


def _decor(canvas, doc):
    width, height = doc.pagesize
    canvas.saveState()
    canvas.setFillColor(GOLD_LIGHT)
    canvas.rect(0, height - 3 * mm, width, 3 * mm, stroke=0, fill=1)
    canvas.restoreState()


def build_receipt_pdf(booking) -> bytes:
    """PDF-чек по выполненной записи: узкая лента 80 мм, высота подбирается под содержимое."""
    _register_fonts()
    width, margin = 80 * mm, 6 * mm
    avail = width - 2 * margin

    brand = ParagraphStyle("brand", fontName="Receipt-Serif", fontSize=24, leading=28, textColor=GOLD, alignment=TA_CENTER)
    small = ParagraphStyle("small", fontName="Receipt", fontSize=8, leading=11, textColor=MUTED, alignment=TA_CENTER)
    title = ParagraphStyle("title", fontName="Receipt-Bold", fontSize=11, leading=14, textColor=TEXT, alignment=TA_CENTER)
    label = ParagraphStyle("label", fontName="Receipt", fontSize=8, leading=11, textColor=MUTED)
    value = ParagraphStyle("value", fontName="Receipt", fontSize=9, leading=12, textColor=TEXT)
    total_label = ParagraphStyle("total_label", fontName="Receipt-Bold", fontSize=11, leading=14, textColor=TEXT)
    total_value = ParagraphStyle("total_value", fontName="Receipt-Bold", fontSize=15, leading=18, textColor=GOLD, alignment=TA_RIGHT)
    note = ParagraphStyle("note", fontName="Receipt", fontSize=7, leading=9.5, textColor=MUTED, alignment=TA_CENTER)

    def line(dash=True):
        return HRFlowable(width="100%", thickness=0.6, color=LINE, dash=[2, 2] if dash else None, spaceBefore=3 * mm, spaceAfter=3 * mm)

    price = booking.price if booking.price is not None else booking.service.price
    rows = [
        ("Услуга", booking.service.name),
        ("Мастер", booking.employee.full_name),
        ("Дата визита", f"{booking.date:%d.%m.%Y}, {booking.start_time:%H:%M}"),
        ("Клиент", booking.display_name),
    ]
    promo = getattr(booking, "promo_code", None)
    if promo:
        rows.append(("Промокод", promo.code))

    details = Table(
        [[Paragraph(name, label), Paragraph(text, value)] for name, text in rows],
        colWidths=[23 * mm, avail - 23 * mm],
    )
    details.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    total = Table([[Paragraph("ИТОГО", total_label), Paragraph(money(price), total_value)]],
                  colWidths=[20 * mm, avail - 20 * mm])
    total.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    story = [Paragraph(SALON_NAME, brand), Paragraph(SALON_SUBTITLE.upper(), small)]
    if SALON_CONTACT:
        story += [Spacer(1, 1.5 * mm), Paragraph(SALON_CONTACT, small)]
    story += [
        line(),
        Paragraph(f"Чек № {booking.pk:06d}", title),
        line(),
        details,
        line(),
        total,
        line(),
        Paragraph("Спасибо, что выбрали Allure!", small),
        Spacer(1, 2 * mm),
        Paragraph("Документ носит информационный характер и не является кассовым чеком.", note),
    ]

    content = sum(f.wrap(avail, 10_000 * mm)[1] + f.getSpaceBefore() + f.getSpaceAfter() for f in story)
    height = content + 2 * margin + 3 * mm + 4 * mm
    buffer = BytesIO()
    doc = BaseDocTemplate(buffer, pagesize=(width, height), title=f"Чек № {booking.pk:06d} — {SALON_NAME}", author=SALON_NAME, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin)
    frame = Frame(margin, margin, avail, height - 2 * margin - 3 * mm, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="receipt", frames=[frame], onPage=_decor)])
    doc.build(story)
    return buffer.getvalue()