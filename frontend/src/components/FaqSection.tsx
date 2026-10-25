import { t } from "@/lib/i18n"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const MAX_DAYS_AHEAD = 90

const FAQ = [
  {
    q: "Как записаться на услугу?",
    a: "Нажмите «Записаться» на любой странице, выберите услугу, мастера, дату и удобное время. Запись доступна после входа в аккаунт: если вы ещё не вошли, сайт сначала предложит войти или зарегистрироваться.",
  },
  {
    q: "На сколько дней вперёд можно записаться?",
    a: "Запись открыта на {days} дней вперёд. Свободное время мастера показывается на этапе выбора даты.",
  },
  {
    q: "Как отменить или перенести запись?",
    a: "Откройте личный кабинет (иконка профиля в шапке). В истории записей есть кнопки отмены и переноса. После отмены время снова становится доступным для других клиентов.",
  },
  {
    q: "Как выбрать мастера?",
    a: "На странице «Мастера» можно посмотреть специалистов и их специализацию. При записи сайт показывает только тех мастеров, которые выполняют выбранную услугу, и их свободное время.",
  },
  {
    q: "Сколько стоит услуга и можно ли посмотреть все цены сразу?",
    a: "Актуальные цены и длительность процедур указаны на странице «Услуги». Там же можно скачать прайс-лист в формате PDF.",
  },
  {
    q: "Как оплатить услугу?",
    a: "Оплата проходит в салоне после процедуры. Мы принимаем наличные и банковские карты.",
  },
  {
    q: "Что делать, если я опаздываю?",
    a: "Позвоните или напишите в салон заранее. Мастер подождёт до 15 минут, при большем опоздании процедуру могут сократить или перенести.",
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <section className="max-w-3xl mx-auto px-6 py-16 w-full">
      <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-10 text-center">
        {t("Частые вопросы")}
      </h2>

      <div className="flex flex-col gap-4">
        {FAQ.map((item, i) => {
          const isOpen = openIndex === i
          return (
            <div
              key={item.q}
              className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 font-medium text-foreground hover:text-gold transition-colors"
              >
                <span>{t(item.q)}</span>
                <ChevronDown
                  className={`size-5 shrink-0 text-gold transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-300 ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-muted-foreground">{t(item.a, { days: MAX_DAYS_AHEAD })}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}