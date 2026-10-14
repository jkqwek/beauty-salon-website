"""
Telegram-бот салона. Запуск (из папки backend, отдельным процессом):
    python telegram_bot/bot.py
"""
import os
import sys
import asyncio
from datetime import datetime, timedelta

import django
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")
if not BOT_TOKEN:
    raise RuntimeError("BOT_TOKEN не найден. Добавьте его в .env файл.")

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from telegram import InlineKeyboardButton as Btn, InlineKeyboardMarkup, Update
from telegram.ext import (ApplicationBuilder, CallbackQueryHandler, CommandHandler,
                          ContextTypes, MessageHandler, filters)

from accounts.models import ClientProfile
from bookings.models import ACTIVE_STATUSES, Booking
from bookings.serializers import BLOCKED_MESSAGE
from bookings.services import (MAX_DAYS_AHEAD, available_days, cancel_deadline_error, get_free_slots,
                               recalc_master_rating, reschedule)
from catalog.models import Employee, Service, price_on

User = get_user_model()
DAYS_SHOWN = min(7, MAX_DAYS_AHEAD + 1)
NOT_LINKED = ("Сначала привяжите аккаунт: в личном кабинете на сайте "
              "нажмите «Подключить Telegram».")

HELP_TEXT = (
    "📋 <b>Команды</b>\n\n"
    "/book — записаться на услугу\n"
    "/my_bookings — мои записи (отмена и перенос)\n"
    "/price — прайс-лист\n"
    "/windows — свободные окна на завтра\n"
    "/contact — написать администратору\n"
    "/help — этот список"
)


# ---------- работа с БД (синхронная, вызывается через sync_to_async) ----------

def db_link(user_id, chat_id):
    user = User.objects.filter(pk=user_id).first() if str(user_id).isdigit() else None
    if user:
        ClientProfile.objects.update_or_create(client=user, defaults={"telegram_chat_id": str(chat_id)})
    return user


def db_user(chat_id):
    p = ClientProfile.objects.filter(telegram_chat_id=str(chat_id)).select_related("client").first()
    return p.client if p else None


def with_today_price(service):
    """Цена на сегодня с учётом акции — для прайса и кнопок (как на странице «Услуги»)."""
    service.price_now, promo = price_on(service, timezone.localdate())
    service.discount = promo.discount_percent if promo else 0
    return service


def price_text(s, html=True):
    if not s.discount:
        return f"{s.price:g} ₽"
    old = f"<s>{s.price:g}</s> " if html else ""
    return f"{old}{s.price_now:g} ₽ (−{s.discount}%)"


def db_price():
    out = {}
    for s in Service.objects.filter(is_active=True).order_by("category", "name"):
        out.setdefault(s.category or "Прочее", []).append(with_today_price(s))
    return out


def db_services():
    return [with_today_price(s) for s in Service.objects.filter(is_active=True).order_by("name")]


def db_employees(service_id):
    return list(Employee.objects.filter(is_active=True, services__id=service_id))


def db_slots(employee_id, service_id, day, exclude_booking_id=None):
    service = Service.objects.get(pk=service_id)
    return get_free_slots(int(employee_id), service, day, exclude_booking_id=exclude_booking_id)


def db_days(employee_id, service_id, exclude_booking_id=None):
    """Ближайшие дни, где у мастера есть свободное время: праздники и занятые дни бот не предлагает."""
    service = Service.all_objects.get(pk=service_id)  # перенос записи на удалённую услугу тоже работает
    today = timezone.localdate()
    return available_days(service, [int(employee_id)], today, today + timedelta(days=DAYS_SHOWN - 1),
                          exclude_booking_id=exclude_booking_id)


def db_create(user, employee_id, service_id, day, hhmm):
    profile = ClientProfile.objects.filter(client=user).first()
    if profile and profile.is_blocked:
        return None, BLOCKED_MESSAGE
    employee = Employee.objects.filter(pk=employee_id, is_active=True).first()
    service = Service.objects.filter(pk=service_id, is_active=True).first()
    if not employee or not service or not employee.services.filter(pk=service.pk).exists():
        return None, "Мастер или услуга недоступны."
    if f"{hhmm[:2]}:{hhmm[2:]}" not in get_free_slots(employee.pk, service, day):
        return None, "Это время уже занято, выберите другое."
    start = datetime.combine(day, datetime.strptime(hhmm, "%H%M").time())
    booking = Booking.objects.create(  # сигнал post_save сам уведомит админа и мастера
        client=user, employee=employee, service=service, date=day,
        start_time=start.time(), end_time=(start + timedelta(minutes=service.duration_minutes)).time(),
        status="pending", price=price_on(service, day)[0],  # со скидкой по дате визита
    )
    return booking, None


def db_my_bookings(user):
    return list(Booking.objects.filter(client=user, status__in=ACTIVE_STATUSES,
                                       date__gte=timezone.localdate())
                .select_related("service", "employee").order_by("date", "start_time"))


def db_get_booking(user, booking_id):
    return (Booking.objects.filter(pk=booking_id, client=user)
            .select_related("service", "employee").first())


def db_cancel(user, booking_id):
    b = db_get_booking(user, booking_id)
    if not b:
        return "Запись не найдена."
    if b.status not in ACTIVE_STATUSES:
        return "Эту запись уже нельзя отменить."
    err = cancel_deadline_error(b)
    if err:
        return err
    b.status = "cancelled"
    b.save()
    return "Запись отменена ✅"


def db_reschedule(user, booking_id, day, hhmm):
    """Те же правила, что на сайте: проверки как у новой записи, снова ждёт подтверждения, цена по новой дате."""
    b = db_get_booking(user, booking_id)
    if not b:
        return "Запись не найдена."
    start = datetime.strptime(hhmm, "%H%M").time()
    error = reschedule(b, day, start)
    if error:
        return error
    return (f"Запись перенесена на {day:%d.%m} в {start:%H:%M} ✅\n"
            f"Цена: {b.price:g} ₽\nЗапись снова ждёт подтверждения салоном.")


def db_rate(user, booking_id, rating):
    b = Booking.objects.filter(pk=booking_id, client=user, status="completed").first()
    if not b:
        return "Запись не найдена."
    b.rating = rating
    b.save(update_fields=["rating"])
    recalc_master_rating(b.employee)  # общий рейтинг с отзывами на сайте
    return "Спасибо за оценку! 💛"


def db_tomorrow_windows():
    day = timezone.localdate() + timedelta(days=1)
    lines = []
    for e in Employee.objects.filter(is_active=True).prefetch_related("services").order_by("full_name"):
        service = min(e.services.filter(is_active=True), key=lambda s: s.duration_minutes, default=None)
        if service:
            slots = get_free_slots(e.pk, service, day)
            if slots:
                lines.append(f"👩‍🎨 <b>{e.full_name}</b>: {', '.join(slots)}")
    return day, lines


def db_all_chats():
    return list(ClientProfile.objects.exclude(telegram_chat_id__isnull=True)
                .exclude(telegram_chat_id="").values_list("telegram_chat_id", flat=True))


run = lambda f, *a: sync_to_async(f)(*a)


# ---------- вспомогательное ----------

def kb(rows):
    return InlineKeyboardMarkup([[Btn(t, callback_data=d) for t, d in row] for row in rows])


def chunk(items, n):
    return [items[i:i + n] for i in range(0, len(items), n)]


async def say(update: Update, text, markup=None):
    """Ответить на сообщение или отредактировать сообщение с кнопкой."""
    if update.callback_query:
        await update.callback_query.edit_message_text(text, reply_markup=markup, parse_mode="HTML")
    else:
        await update.message.reply_text(text, reply_markup=markup, parse_mode="HTML")


async def need_user(update: Update):
    user = await run(db_user, update.effective_chat.id)
    if not user:
        await say(update, NOT_LINKED)
    return user


def days_buttons(prefix, days):
    return chunk([(f"{d:%d.%m}", f"{prefix}:{d:%Y%m%d}") for d in days], 4)


def parse_day(s):
    return datetime.strptime(s, "%Y%m%d").date()


def slots_buttons(prefix, slots):
    return chunk([(s, f"{prefix}:{s.replace(':', '')}") for s in slots], 4)


# ---------- команды ----------

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.args:
        user = await run(db_link, context.args[0], update.effective_chat.id)
        if user:
            await update.message.reply_text(
                f"Готово, {user.first_name or user.username}! ✅\n"
                "Теперь я буду присылать напоминания о записях.\n\n" + HELP_TEXT, parse_mode="HTML")
            return
    await update.message.reply_text(
        "Привет! 👋\n\nЧтобы пользоваться ботом, зайдите в личный кабинет на сайте "
        "и нажмите «Подключить Telegram».\n\n" + HELP_TEXT, parse_mode="HTML")


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode="HTML")


async def price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    groups = await run(db_price)
    if not groups:
        return await update.message.reply_text("Прайс пока пуст.")
    text = "💰 <b>Прайс-лист</b>\n"
    for cat, services in groups.items():
        text += f"\n<b>{cat}</b>\n" + "\n".join(
            f"• {s.name} — {price_text(s)} ({s.duration_minutes} мин)" for s in services) + "\n"
    await update.message.reply_text(text, parse_mode="HTML")


async def windows(update: Update, context: ContextTypes.DEFAULT_TYPE):
    day, lines = await run(db_tomorrow_windows)
    text = f"🕒 <b>Свободно на {day:%d.%m}</b>\n\n" + ("\n".join(lines) or "Свободных окон нет.")
    await update.message.reply_text(text, parse_mode="HTML")


# --- запись через бота ---

async def book(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not await need_user(update):
        return
    services = await run(db_services)
    await say(update, "Выберите услугу:",
              kb([[(f"{s.name} — {price_text(s, html=False)}", f"bs:{s.id}")] for s in services]))


async def book_service(update, context):
    sid = update.callback_query.data.split(":")[1]
    emps = await run(db_employees, sid)
    if not emps:
        return await say(update, "Для этой услуги нет мастеров.")
    await say(update, "Выберите мастера:", kb([[(e.full_name, f"be:{sid}:{e.id}")] for e in emps]))


async def book_employee(update, context):
    _, sid, eid = update.callback_query.data.split(":")
    days = await run(db_days, eid, sid)
    if not days:
        return await say(update, "На ближайшую неделю у мастера нет свободного времени. Попробуйте другого: /book")
    await say(update, "Выберите дату:", kb(days_buttons(f"bd:{sid}:{eid}", days)))


async def book_day(update, context):
    _, sid, eid, day = update.callback_query.data.split(":")
    slots = await run(db_slots, eid, sid, parse_day(day))
    if not slots:
        return await say(update, "На эту дату нет свободного времени. Попробуйте другую: /book")
    await say(update, "Выберите время:", kb(slots_buttons(f"bt:{sid}:{eid}:{day}", slots)))


async def book_time(update, context):
    _, sid, eid, day, hhmm = update.callback_query.data.split(":")
    user = await need_user(update)
    if not user:
        return
    booking, error = await run(db_create, user, eid, sid, parse_day(day), hhmm)
    if error:
        return await say(update, error)
    await say(update, f"✅ Вы записаны!\n{booking.service.name}, {booking.date:%d.%m} в "
                      f"{booking.start_time:%H:%M}\nМастер: {booking.employee.full_name}\n"
                      "Запись ждёт подтверждения салоном.")


# --- мои записи, отмена, перенос ---

async def my_bookings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = await need_user(update)
    if not user:
        return
    items = await run(db_my_bookings, user)
    if not items:
        return await update.message.reply_text("У вас нет предстоящих записей. Записаться: /book")
    for b in items:
        await update.message.reply_text(
            f"📅 {b.date:%d.%m} в {b.start_time:%H:%M}\n{b.service.name}\nМастер: {b.employee.full_name}",
            reply_markup=kb([[("🔁 Перенести", f"rs:{b.id}"), ("❌ Отменить", f"cx:{b.id}")]]))


async def cancel_ask(update, context):
    bid = update.callback_query.data.split(":")[1]
    await say(update, "Точно отменить запись?", kb([[("Да, отменить", f"cy:{bid}"), ("Нет", "noop")]]))


async def cancel_do(update, context):
    user = await need_user(update)
    if user:
        await say(update, await run(db_cancel, user, update.callback_query.data.split(":")[1]))


async def noop(update, context):
    await say(update, "Хорошо, ничего не меняю.")


async def resched_start(update, context):
    bid = update.callback_query.data.split(":")[1]
    user = await need_user(update)
    if not user:
        return
    b = await run(db_get_booking, user, bid)
    if not b:
        return await say(update, "Запись не найдена.")
    days = await run(db_days, b.employee_id, b.service_id, b.pk)
    if not days:
        return await say(update, "На ближайшую неделю свободного времени нет. Свяжитесь с салоном: /contact")
    await say(update, "Выберите новую дату:", kb(days_buttons(f"rd:{bid}", days)))


async def resched_day(update, context):
    _, bid, day = update.callback_query.data.split(":")
    user = await need_user(update)
    if not user:
        return
    b = await run(db_get_booking, user, bid)
    if not b:
        return await say(update, "Запись не найдена.")
    slots = await run(db_slots, b.employee_id, b.service_id, parse_day(day), b.pk)
    if not slots:
        return await say(update, "На эту дату нет свободного времени. Попробуйте другую: /my_bookings")
    await say(update, "Выберите новое время:", kb(slots_buttons(f"rt:{bid}:{day}", slots)))


async def resched_time(update, context):
    _, bid, day, hhmm = update.callback_query.data.split(":")
    user = await need_user(update)
    if user:
        await say(update, await run(db_reschedule, user, bid, parse_day(day), hhmm))


# --- опрос после визита ---

async def survey_answer(update, context):
    _, bid, n = update.callback_query.data.split(":")
    user = await need_user(update)
    if user:
        await say(update, await run(db_rate, user, bid, int(n)))


# --- связь с администратором и рассылка ---

def is_admin(update: Update):
    return ADMIN_CHAT_ID and str(update.effective_chat.id) == str(ADMIN_CHAT_ID)


async def contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["await_contact"] = True
    await update.message.reply_text("Напишите сообщение одним текстом, я передам его администратору.")


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.user_data.pop("await_contact", False):
        return await update.message.reply_text("Не понял 🙈 Список команд: /help")
    if not ADMIN_CHAT_ID:
        return await update.message.reply_text("Связь с администратором пока не настроена.")
    u = update.effective_user
    await context.bot.send_message(
        ADMIN_CHAT_ID,
        f"✉️ Сообщение от {u.full_name} (@{u.username or '—'}), chat_id {update.effective_chat.id}:\n\n"
        f"{update.message.text}\n\nОтветить: /reply {update.effective_chat.id} текст")
    await update.message.reply_text("Передано администратору ✅ Мы скоро ответим.")


async def reply_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update) or len(context.args) < 2:
        return
    await context.bot.send_message(context.args[0], "💬 Администратор: " + " ".join(context.args[1:]))
    await update.message.reply_text("Отправлено ✅")


async def broadcast(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/broadcast текст акции — только для администратора."""
    if not is_admin(update):
        return
    if not context.args:
        return await update.message.reply_text("Использование: /broadcast текст акции")
    text = "🎉 " + " ".join(context.args)
    sent = 0
    for chat_id in await run(db_all_chats):
        try:
            await context.bot.send_message(chat_id, text)
            sent += 1
        except Exception:
            pass  # клиент заблокировал бота
        await asyncio.sleep(0.05)  # лимит Telegram ~30 сообщений/сек
    await update.message.reply_text(f"Рассылка отправлена: {sent} клиентам.")


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    for name, fn in [("start", start), ("help", help_cmd), ("price", price), ("windows", windows),
                     ("book", book), ("my_bookings", my_bookings), ("contact", contact),
                     ("reply", reply_cmd), ("broadcast", broadcast)]:
        app.add_handler(CommandHandler(name, fn))
    for pattern, fn in [("^bs:", book_service), ("^be:", book_employee), ("^bd:", book_day),
                        ("^bt:", book_time), ("^cx:", cancel_ask), ("^cy:", cancel_do),
                        ("^rs:", resched_start), ("^rd:", resched_day), ("^rt:", resched_time),
                        ("^sv:", survey_answer), ("^noop$", noop)]:
        app.add_handler(CallbackQueryHandler(fn, pattern=pattern))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    print("Бот запущен. Ctrl+C для остановки.")
    app.run_polling()


if __name__ == "__main__":
    main()
