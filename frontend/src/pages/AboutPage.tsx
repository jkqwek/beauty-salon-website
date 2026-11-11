import { NavLink, useOutletContext } from "react-router"
import { ArrowRight, Gem, Sofa, Sparkles } from "lucide-react"
import { t } from "@/lib/i18n"
import { Breadcrumbs } from "../components/Breadcrumbs"
import { LocationSection } from "../components/LocationSection"

const FEATURES = [
  {
    icon: Sparkles,
    title: "Опытные мастера",
    text: "Каждый мастер — профессионал с многолетним опытом, который регулярно проходит обучение."
  },
  {
    icon: Gem,
    title: "Премиальная косметика",
    text: "Работаем только с проверенными профессиональными брендами."
  },
  {
    icon: Sofa,
    title: "Уютная атмосфера",
    text: "Спокойное пространство, где можно отдохнуть от суеты города."
  },
]

export function AboutPage() {
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  return (
    <div className="min-h-screen bg-pearl">

      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <Breadcrumbs items={[{ label: t("Главная"), to: "/" }, { label: t("О нас") }]} />
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">{t("О салоне Allure")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
          {t("Место, где забота о себе становится удовольствием.")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6 text-lg text-muted-foreground leading-relaxed">
        <p>{t("Allure открылся с простой идеей: каждый гость должен уходить от нас отдохнувшим и уверенным в себе.")}</p>
        <p>{t("Мы собрали команду мастеров, которые любят своё дело, и создали пространство, где хочется задержаться подольше.")}</p>
        <p>{t("Стрижки и окрашивание, маникюр, уход за кожей и массаж — всё в одном месте и с одинаково внимательным отношением.")}</p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="bg-white rounded-3xl border border-rose-100 p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col items-center"
            >
              <div className="size-16 rounded-full bg-rose-50 text-gold flex items-center justify-center mb-6">
                <Icon className="size-8 stroke-[1.5]" />
              </div>
              <h3 className="text-xl font-serif text-foreground mb-3">{t(title)}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{t(text)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-rose-50 border-y border-rose-100 py-16 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-4">{t("Наша команда")}</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-lg">
          {t("Познакомьтесь с мастерами и выберите своего.")}
        </p>
        <NavLink
          to="/masters"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full border-2 border-gold text-gold font-medium hover:bg-gold hover:text-white transition-colors"
        >
          {t("Все мастера")} <ArrowRight className="size-4" />
        </NavLink>
      </div>

      <LocationSection />

      <div className="text-center py-20 bg-pearl">
        <button
          onClick={openBooking}
          className="bg-gold hover:bg-gold-hover text-white px-10 py-4 rounded-full text-lg font-semibold transition-colors shadow-md hover:shadow-lg"
        >
          {t("Записаться")}
        </button>
      </div>
      
    </div>
  )
}