# Telegram-бот для салона красоты

## Структура

```
telegram_bot/
├── bot.py              # запуск бота, /start, привязка клиента
├── notify.py           # функции отправки уведомлений (вызываются из Django)
├── tasks.py            # Celery-задача для ежедневных напоминаний
├── requirements.txt
└── .env.example        # шаблон переменных окружения
```

## Быстрый старт

1. **Получите токен у [@BotFather](https://t.me/BotFather)**
   `/newbot` → следуйте инструкциям → скопируйте токен.

2. **Узнайте свой chat_id** (чтобы получать уведомления как админ)
   Напишите [@userinfobot](https://t.me/userinfobot) — он пришлёт ваш id.

3. **Настройте окружение**
   ```bash
   cp .env.example .env
   # впишите BOT_TOKEN и ADMIN_CHAT_ID в .env
   pip install -r requirements.txt
   ```

4. **Поправьте под свой проект**
   - В `bot.py`: замените `"config.settings"` на реальный путь к settings.py вашего Django-проекта
   - Раскомментируйте импорты моделей (`Appointment`, `CustomUser`), когда они будут готовы
   - В `notify.py` и `tasks.py` — то же самое

5. **Запустите бота отдельным процессом** (не через `manage.py runserver`)
   ```bash
   python telegram_bot/bot.py
   ```

## Как это работает

### Уведомление админу (простая часть)
Когда в Django создаётся новая запись (`Appointment`), вызовите:

```python
from telegram_bot.notify import notify_admin_new_appointment

notify_admin_new_appointment(
    client_name=appointment.client.get_full_name(),
    service_name=appointment.service.name,
    employee_name=appointment.employee.name,
    date_time=f"{appointment.date} {appointment.time}",
)
```

Удобнее всего вызвать это в **сериализаторе** (в методе `create()` эндпоинта `POST /api/appointments/`) или через **Django-сигнал** `post_save`.

### Напоминания клиентам (сложная часть, Celery)
1. У модели пользователя должно быть поле `telegram_chat_id` (добавьте миграцию)
2. Клиент пишет боту `/start` и присылает номер телефона — бот находит пользователя и сохраняет его chat_id (сейчас в `bot.py` это заглушка — нужно дописать реальный поиск)
3. Celery-задача `send_daily_reminders` из `tasks.py` запускается по расписанию (раз в день) и рассылает напоминания всем, у кого запись завтра

Для Celery понадобится Redis как брокер — если ещё не установлен:
```bash
# Ubuntu/Debian
sudo apt install redis-server
# или через Docker
docker run -d -p 6379:6379 redis
```

## Тестирование вручную

```python
# В django shell (python manage.py shell):
from telegram_bot.notify import notify_admin_new_appointment
notify_admin_new_appointment("Тест Тестов", "Стрижка", "Мария", "2026-09-10 15:00")
# Проверьте, пришло ли сообщение в Telegram
```

## Частые проблемы

- **Бот не отвечает** — проверьте, что процесс `bot.py` запущен и токен верный
- **Уведомление не приходит** — проверьте `ADMIN_CHAT_ID`, убедитесь что вы писали боту хотя бы раз (Telegram не даст слать сообщения "первому" непроинициированному чату для личных чатов, но для этого сценария админ обычно сам пишет боту `/start` один раз)
- **ImportError при импорте моделей** — проверьте путь `DJANGO_SETTINGS_MODULE` в `bot.py`, он должен указывать на реальный settings.py вашего проекта
