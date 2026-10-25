// pages/VacanciesPage.tsx
import { Briefcase, Check, Mail } from "lucide-react"

// Замени на настоящую почту салона
const HR_EMAIL = "hr@allure-salon.example"

const VACANCIES = [
  {
    title: "Стилист-колорист",
    schedule: "Сменный график, 2/2",
    requirements: [
      "Опыт работы от 2 лет",
      "Владение современными техниками окрашивания",
      "Портфолио работ",
    ],
    conditions: [
      "Современное оборудование и профессиональная косметика",
      "Поток клиентов от салона",
      "Обучение и повышение квалификации",
    ],
  },
  {
    title: "Мастер маникюра и педикюра",
    schedule: "Сменный график, 2/2",
    requirements: [
      "Опыт работы от 1 года",
      "Умение работать с гель-лаком и дизайном",
      "Соблюдение санитарных норм",
    ],
    conditions: [
      "Оборудованное рабочее место",
      "Онлайн-запись клиентов через сайт",
      "Дружный коллектив",
    ],
  },
  {
    title: "Администратор",
    schedule: "Полный день",
    requirements: [
      "Грамотная речь и коммуникабельность",
      "Уверенное пользование ПК",
      "Ответственность и аккуратность",
    ],
    conditions: [
      "Стабильная занятость",
      "Работа в приятной атмосфере",
      "Возможность карьерного роста",
    ],
  },
  {
    title: "Массажист",
    schedule: "Гибкий график",
    requirements: [
      "Профильное образование или сертификат",
      "Опыт работы от 1 года",
      "Знание классических техник массажа",
    ],
    conditions: [
      "Отдельный оборудованный кабинет",
      "Постоянные клиенты",
      "Возможность вести собственное направление",
    ],
  },
]

export function VacanciesPage() {
  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          Вакансии
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Присоединяйтесь к команде Allure. Мы ищем увлечённых специалистов,
          которые любят своё дело и заботятся о клиентах.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        <div className="flex flex-col gap-6">
          {VACANCIES.map((v) => (
            <div
              key={v.title}
              className="bg-white rounded-3xl border border-rose-100 shadow-sm hover:shadow-md transition-shadow p-6 md:p-8"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-serif text-foreground mb-1">
                    {v.title}
                  </h2>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="size-4 text-gold" /> {v.schedule}
                  </p>
                </div>

                <a
                  href={`mailto:${HR_EMAIL}?subject=${encodeURIComponent(
                    `Отклик на вакансию: ${v.title}`,
                  )}`}
                  className="inline-flex items-center justify-center gap-2 border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-colors shrink-0"
                >
                  <Mail className="size-4" />
                  Откликнуться
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Требования
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {v.requirements.map((r) => (
                      <li key={r} className="flex items-start gap-2 text-foreground">
                        <Check className="size-4 text-gold mt-1 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Условия
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {v.conditions.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-foreground">
                        <Check className="size-4 text-gold mt-1 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground text-sm mt-12">
          Не нашли подходящую вакансию? Пришлите резюме на{" "}
          <a href={`mailto:${HR_EMAIL}`} className="text-gold hover:text-gold-hover">
            {HR_EMAIL}
          </a>
          , мы свяжемся с вами, когда появится место.
        </p>
      </div>
    </div>
  )
}