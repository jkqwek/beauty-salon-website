"""Тесты Telegram-бота (задача 137): работа с базой, обработчики команд, уведомления и задачи Celery.
В сеть ничего не отправляется: Telegram и requests подменяются заглушками."""
import json
import os
import sys
from datetime import time, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("BOT_TOKEN", "123456:TEST-TOKEN")  # bot.py не импортируется без токена

import requests
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from accounts.models import ClientProfile
from bookings.models import Booking, CancellationPolicy, Schedule
from bookings.serializers import BLOCKED_MESSAGE
from catalog.models import Employee, Service
from telegram_bot import bot, notify, tasks

User = get_user_model()


class BotDataMixin:
    """Мастер с графиком на послезавтра-плюс-день и два клиента: anna привязана к Telegram."""

    def setUp(self):
        super().setUp()
        for name in ("notify_admin_new_appointment", "notify_master_new_booking"):  # сигнал записи не шлёт в сеть
            patcher = patch(f"bookings.signals.{name}")
            patcher.start()
            self.addCleanup(patcher.stop)
        self.today = timezone.localdate()
        self.day = self.today + timedelta(days=3)
        self.master = Employee.objects.create(full_name="Мастер", specialization="—")
        self.service = Service.objects.create(name="Стрижка", price=1000, duration_minutes=60, category="Волосы")
        self.master.services.add(self.service)
        Schedule.objects.create(employee=self.master, day_of_week=self.day.weekday(),
                                start_time=time(10), end_time=time(12))
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 0})
        self.anna = User.objects.create_user("anna", password="x")
        self.bob = User.objects.create_user("bob", password="x")
        ClientProfile.objects.create(client=self.anna, telegram_chat_id="1001")

    def booking(self, client=None, status="confirmed", day=None, at=10):
        return Booking.objects.create(
            client=client or self.anna, employee=self.master, service=self.service, price=1000,
            date=day or self.day, start_time=time(at), end_time=time(at + 1), status=status,
        )


class BotDatabaseTests(BotDataMixin, TestCase):
    def test_link_and_find_user(self):
        self.assertEqual(bot.db_user(1001), self.anna)
        self.assertIsNone(bot.db_user(555))
        self.assertEqual(bot.db_link(self.bob.id, 2002), self.bob)
        self.assertEqual(bot.db_user(2002), self.bob)
        self.assertIsNone(bot.db_link("abc", 3))  # нечисловой id из ссылки
        self.assertIsNone(bot.db_link(999999, 3))  # такого пользователя нет

    def test_price_list(self):
        Service.objects.create(name="Скрытая", price=500, duration_minutes=30, category="Ногти", is_active=False)
        Service.objects.create(name="Маникюр", price=800, duration_minutes=45)  # без категории
        groups = bot.db_price()
        self.assertEqual(set(groups), {"Волосы", "Прочее"})
        self.assertEqual([s.name for s in groups["Волосы"]], ["Стрижка"])
        self.assertEqual(groups["Волосы"][0].price_now, 1000)
        self.assertNotIn("Скрытая", [s.name for s in bot.db_services()])

    def test_masters_for_service(self):
        self.assertEqual(bot.db_employees(self.service.id), [self.master])
        Employee.objects.filter(pk=self.master.pk).update(is_active=False)
        self.assertEqual(bot.db_employees(self.service.id), [])

    def test_free_slots(self):
        self.assertIn("10:00", bot.db_slots(self.master.id, self.service.id, self.day))
        self.booking(at=10)
        self.assertNotIn("10:00", bot.db_slots(self.master.id, self.service.id, self.day))

    # ----- запись -----

    def test_create_booking(self):
        booking, error = bot.db_create(self.anna, self.master.id, self.service.id, self.day, "1000")
        self.assertIsNone(error)
        self.assertEqual((booking.status, booking.start_time, booking.end_time), ("pending", time(10), time(11)))
        self.assertEqual(booking.price, 1000)
        self.assertEqual(Booking.objects.filter(client=self.anna).count(), 1)

    def test_create_booking_rejects_taken_and_wrong_time(self):
        self.assertIsNone(bot.db_create(self.anna, self.master.id, self.service.id, self.day, "1000")[1])
        booking, error = bot.db_create(self.bob, self.master.id, self.service.id, self.day, "1000")
        self.assertIsNone(booking)
        self.assertIn("занято", error)
        booking, error = bot.db_create(self.bob, self.master.id, self.service.id, self.day, "1500")  # вне графика
        self.assertIsNone(booking)
        self.assertIn("занято", error)
        self.assertEqual(Booking.objects.count(), 1)

    def test_create_booking_rejects_unavailable_master_or_service(self):
        other = Service.objects.create(name="Маникюр", price=500, duration_minutes=30)
        self.assertEqual(bot.db_create(self.anna, self.master.id, other.id, self.day, "1000"),
                         (None, "Мастер или услуга недоступны."))
        self.assertEqual(bot.db_create(self.anna, 999999, self.service.id, self.day, "1000"),
                         (None, "Мастер или услуга недоступны."))

    def test_blocked_client_cannot_book(self):
        ClientProfile.objects.filter(client=self.anna).update(is_blocked=True)
        self.assertEqual(bot.db_create(self.anna, self.master.id, self.service.id, self.day, "1000"),
                         (None, BLOCKED_MESSAGE))

    def test_my_bookings(self):
        later = self.booking(day=self.today + timedelta(days=4), at=11)
        first = self.booking(day=self.day, at=10)
        self.booking(status="cancelled", at=11)  # отменённая
        self.booking(status="completed", at=11)  # выполненная
        self.booking(day=self.today - timedelta(days=1), at=10)  # прошедшая
        self.booking(client=self.bob, at=11)  # чужая
        self.assertEqual(bot.db_my_bookings(self.anna), [first, later])  # по порядку времени

    # ----- отмена и перенос -----

    def test_cancel(self):
        b = self.booking()
        self.assertEqual(bot.db_cancel(self.bob, b.id), "Запись не найдена.")  # чужую отменить нельзя
        self.assertEqual(bot.db_cancel(self.anna, 999999), "Запись не найдена.")
        self.assertEqual(bot.db_cancel(self.anna, b.id), "Запись отменена ✅")
        b.refresh_from_db()
        self.assertEqual(b.status, "cancelled")
        self.assertEqual(bot.db_cancel(self.anna, b.id), "Эту запись уже нельзя отменить.")

    def test_cancel_deadline(self):
        CancellationPolicy.objects.update_or_create(pk=1, defaults={"deadline_hours": 500})
        b = self.booking()
        self.assertIn("500 ч", bot.db_cancel(self.anna, b.id))
        b.refresh_from_db()
        self.assertEqual(b.status, "confirmed")

    def test_reschedule(self):
        b = self.booking(at=10)
        self.assertEqual(bot.db_reschedule(self.bob, b.id, self.day, "1100"), "Запись не найдена.")
        result = bot.db_reschedule(self.anna, b.id, self.day, "1100")
        self.assertTrue(result.startswith("Запись перенесена"), result)
        b.refresh_from_db()
        self.assertEqual((b.start_time, b.end_time, b.status), (time(11), time(12), "pending"))

    def test_reschedule_to_taken_time(self):
        b = self.booking(at=10)
        self.booking(client=self.bob, at=11)
        self.assertEqual(bot.db_reschedule(self.anna, b.id, self.day, "1100"),
                         "Это время недоступно, выберите другое.")
        b.refresh_from_db()
        self.assertEqual(b.start_time, time(10))

    # ----- оценка после визита -----

    def test_rating_updates_master_rating(self):
        first, second = self.booking(status="completed", at=10), self.booking(status="completed", at=11)
        self.assertEqual(bot.db_rate(self.anna, first.id, 5), "Спасибо за оценку! 💛")
        self.master.refresh_from_db()
        self.assertEqual(self.master.rating, 5)
        bot.db_rate(self.anna, second.id, 4)
        self.master.refresh_from_db()
        self.assertEqual(self.master.rating, Decimal("4.5"))  # среднее по оценкам

    def test_rating_only_for_own_completed_booking(self):
        pending = self.booking(status="confirmed")
        done = self.booking(status="completed", at=11)
        self.assertEqual(bot.db_rate(self.anna, pending.id, 5), "Запись не найдена.")
        self.assertEqual(bot.db_rate(self.bob, done.id, 5), "Запись не найдена.")
        done.refresh_from_db()
        self.assertIsNone(done.rating)

    # ----- рассылка и окна на завтра -----

    def test_broadcast_recipients(self):
        ClientProfile.objects.create(client=self.bob, telegram_chat_id="2002")
        carol = User.objects.create_user("carol", password="x")
        ClientProfile.objects.create(client=carol, telegram_chat_id="")  # не подключала бота
        User.objects.create_user("dave", password="x")  # профиля нет
        self.assertEqual(set(bot.db_all_chats()), {"1001", "2002"})

    def test_tomorrow_windows(self):
        tomorrow = self.today + timedelta(days=1)
        day, lines = bot.db_tomorrow_windows()
        self.assertEqual((day, lines), (tomorrow, []))  # график на завтра не заведён
        Schedule.objects.create(employee=self.master, day_of_week=tomorrow.weekday(),
                                start_time=time(10), end_time=time(12))
        day, lines = bot.db_tomorrow_windows()
        self.assertEqual(len(lines), 1)
        self.assertIn("Мастер", lines[0])
        self.assertIn("10:00", lines[0])


def fake_update(text="привет", chat_id=1001):
    update = MagicMock()
    update.effective_chat.id = chat_id
    update.effective_user.full_name = "Анна Смирнова"
    update.effective_user.username = "anna"
    update.message.text = text
    update.message.reply_text = AsyncMock()
    return update


def fake_context(args=None):
    context = MagicMock()
    context.args = args or []
    context.user_data = {}
    context.bot.send_message = AsyncMock()
    return context


def reply_of(update):
    return update.message.reply_text.await_args.args[0]


class BotHandlersTests(SimpleTestCase):
    """Команды, которым база не нужна."""

    async def test_help_lists_all_commands(self):
        update = fake_update()
        await bot.help_cmd(update, fake_context())
        update.message.reply_text.assert_awaited_once()
        for command in ("/book", "/my_bookings", "/price", "/windows", "/contact", "/help"):
            self.assertIn(command, reply_of(update))

    async def test_unknown_text(self):
        update = fake_update("что-то непонятное")
        context = fake_context()
        await bot.text_message(update, context)
        self.assertIn("/help", reply_of(update))
        context.bot.send_message.assert_not_awaited()

    async def test_message_to_admin(self):
        context = fake_context()
        with patch.object(bot, "ADMIN_CHAT_ID", "777"):
            await bot.contact(fake_update(), context)
            self.assertTrue(context.user_data["await_contact"])

            update = fake_update("Хочу перенести запись")
            await bot.text_message(update, context)
        context.bot.send_message.assert_awaited_once()
        chat_id, text = context.bot.send_message.await_args.args
        self.assertEqual(chat_id, "777")
        self.assertIn("Хочу перенести запись", text)
        self.assertIn("/reply 1001", text)  # администратору сразу видно, как ответить
        self.assertIn("Передано администратору", reply_of(update))
        self.assertNotIn("await_contact", context.user_data)  # режим одноразовый

    async def test_message_to_admin_without_admin_chat(self):
        context = fake_context()
        context.user_data["await_contact"] = True
        update = fake_update("Привет")
        with patch.object(bot, "ADMIN_CHAT_ID", None):
            await bot.text_message(update, context)
        context.bot.send_message.assert_not_awaited()
        self.assertIn("не настроена", reply_of(update))

    async def test_admin_reply(self):
        context = fake_context(["1001", "Ждём", "вас"])
        with patch.object(bot, "ADMIN_CHAT_ID", "777"):
            await bot.reply_cmd(fake_update(chat_id=777), context)
        context.bot.send_message.assert_awaited_once_with("1001", "💬 Администратор: Ждём вас")

    async def test_admin_commands_are_closed_for_clients(self):
        for handler in (bot.reply_cmd, bot.broadcast):
            context = fake_context(["1001", "текст"])
            update = fake_update(chat_id=1001)
            with patch.object(bot, "ADMIN_CHAT_ID", "777"):
                await handler(update, context)
            context.bot.send_message.assert_not_awaited()
            update.message.reply_text.assert_not_awaited()

    async def test_broadcast(self):
        context = fake_context(["Скидка", "20%"])
        update = fake_update(chat_id=777)
        with patch.object(bot, "ADMIN_CHAT_ID", "777"), patch.object(bot, "db_all_chats", lambda: ["1", "2"]):
            await bot.broadcast(update, context)
        self.assertEqual(context.bot.send_message.await_count, 2)
        context.bot.send_message.assert_any_await("1", "🎉 Скидка 20%")
        self.assertIn("2 клиентам", reply_of(update))

    async def test_broadcast_without_text(self):
        update = fake_update(chat_id=777)
        with patch.object(bot, "ADMIN_CHAT_ID", "777"):
            await bot.broadcast(update, fake_context())
        self.assertIn("/broadcast", reply_of(update))


class NotifyTests(SimpleTestCase):
    def setUp(self):
        for target in (patch.object(sys, "argv", ["manage.py"]),  # в тестах отправку блокирует проверка "test" в argv
                       patch.object(notify, "BOT_TOKEN", "token"),
                       patch.object(notify, "ADMIN_CHAT_ID", "777")):
            target.start()
            self.addCleanup(target.stop)

    def sent(self, call):
        return call.call_args.kwargs["data"]

    def test_admin_gets_new_booking(self):
        with patch.object(notify.requests, "post") as post:
            self.assertTrue(notify.notify_admin_new_appointment("Анна <b>", "Стрижка", "Мастер", "01.01.2027 10:00"))
        post.assert_called_once()
        data = self.sent(post)
        self.assertEqual((data["chat_id"], data["parse_mode"]), ("777", "HTML"))
        self.assertIn("Анна &lt;b&gt;", data["text"])  # теги из имени не ломают разметку
        self.assertIn("01.01.2027 10:00", data["text"])

    def test_master_gets_new_booking(self):
        with patch.object(notify.requests, "post") as post:
            self.assertTrue(notify.notify_master_new_booking("55", "Анна", "Стрижка", "10:00"))
        self.assertEqual(self.sent(post)["chat_id"], "55")
        self.assertIn("Стрижка", self.sent(post)["text"])

    def test_client_reminder(self):
        with patch.object(notify.requests, "post") as post:
            self.assertTrue(notify.notify_client_reminder("1001", "Стрижка", "02.01 10:00"))
        self.assertEqual(self.sent(post)["chat_id"], "1001")
        self.assertIn("02.01 10:00", self.sent(post)["text"])

    def test_survey_has_five_buttons(self):
        with patch.object(notify.requests, "post") as post:
            self.assertTrue(notify.send_survey("1001", 7, "Стрижка"))
        keyboard = json.loads(self.sent(post)["reply_markup"])["inline_keyboard"]
        self.assertEqual([b["callback_data"] for b in keyboard[0]], [f"sv:7:{n}" for n in range(1, 6)])

    def test_no_admin_chat(self):
        with patch.object(notify, "ADMIN_CHAT_ID", None), patch.object(notify.requests, "post") as post:
            self.assertFalse(notify.notify_admin_new_appointment("Анна", "Стрижка", "Мастер", "10:00"))
            self.assertFalse(notify.notify_admin_text("текст"))
        post.assert_not_called()

    def test_no_token(self):
        with patch.object(notify, "BOT_TOKEN", ""), patch.object(notify.requests, "post") as post:
            self.assertFalse(notify.notify_client_reminder("1001", "Стрижка", "10:00"))
        post.assert_not_called()

    def test_network_errors_do_not_break_the_site(self):
        with patch.object(notify.requests, "post", side_effect=requests.ConnectionError("нет сети")):
            self.assertFalse(notify.notify_client_reminder("1001", "Стрижка", "10:00"))
        with patch.object(notify.requests, "post") as post:
            post.return_value.raise_for_status.side_effect = requests.HTTPError("403")
            self.assertFalse(notify.notify_client_reminder("1001", "Стрижка", "10:00"))


class BotTasksTests(BotDataMixin, TestCase):
    def test_daily_reminders(self):
        tomorrow = self.today + timedelta(days=1)
        self.booking(day=tomorrow, status="confirmed", at=10)
        self.booking(day=tomorrow, status="cancelled", at=11)  # отменённой напоминать не нужно
        self.booking(client=self.bob, day=tomorrow, status="confirmed", at=11)  # у bob нет Telegram
        self.booking(day=self.today + timedelta(days=2), status="confirmed", at=11)  # не завтра
        with patch("telegram_bot.tasks.notify_client_reminder", return_value=True) as remind:
            result = tasks.send_daily_reminders()
        remind.assert_called_once_with("1001", "Стрижка", f"{tomorrow:%d.%m} 10:00")
        self.assertIn("1", result)

    def test_surveys_are_sent_once(self):
        done = self.booking(status="completed")
        self.booking(status="confirmed", at=11)  # визит ещё не прошёл
        with patch("telegram_bot.tasks.send_survey", return_value=True) as survey:
            tasks.send_surveys()
            tasks.send_surveys()
        survey.assert_called_once_with("1001", done.id, "Стрижка")
        done.refresh_from_db()
        self.assertTrue(done.survey_sent)

    def test_failed_survey_is_retried(self):
        done = self.booking(status="completed")
        with patch("telegram_bot.tasks.send_survey", return_value=False):
            tasks.send_surveys()
        done.refresh_from_db()
        self.assertFalse(done.survey_sent)  # не получилось отправить — попробуем в следующий раз

    def test_free_windows_for_admin(self):
        with patch("telegram_bot.tasks.notify_admin_text") as notify_admin:
            self.assertEqual(tasks.notify_free_windows(), "Свободных окон нет")
        notify_admin.assert_not_called()

        tomorrow = self.today + timedelta(days=1)
        Schedule.objects.create(employee=self.master, day_of_week=tomorrow.weekday(),
                                start_time=time(10), end_time=time(12))
        with patch("telegram_bot.tasks.notify_admin_text") as notify_admin:
            tasks.notify_free_windows()
        text = notify_admin.call_args.args[0]
        self.assertIn("Мастер", text)
        self.assertIn("10:00", text)
