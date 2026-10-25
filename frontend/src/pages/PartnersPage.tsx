// pages/PartnersPage.tsx
import { Heart, Megaphone, Package, Truck } from "lucide-react"

// Замени на настоящую почту салона
const PARTNERS_EMAIL = "partners@allure-salon.example"

const COOPERATION = [
  {
    icon: Package,
    title: "Косметические бренды",
    text: "Презентуем вашу продукцию клиентам и используем её в процедурах, если она подходит нашим стандартам качества.",
  },
  {
    icon: Truck,
    title: "Поставщики",
    text: "Работаем с надёжными поставщиками профессиональной косметики, инструментов и расходных материалов.",
  },
  {
    icon: Megaphone,
    title: "Блогеры и медиа",
    text: "Приглашаем к совместным проектам, обзорам процедур и мероприятиям салона.",
  },
  {
    icon: Heart,
    title: "Социальные проекты",
    text: "Поддерживаем благотворительные акции и местные инициативы вместе с партнёрами.",
  },
]

// Вымышленные названия, пока нет настоящих партнёров
const PARTNERS = [
  { name: "Lumière Cosmetics", category: "Косметика" },
  { name: "Silk & Co", category: "Уход за волосами" },
  { name: "Nail Studio Pro", category: "Материалы для маникюра" },
  { name: "Aroma Garden", category: "Массажные масла" },
  { name: "Glow Magazine", category: "Медиапартнёр" },
  { name: "Beauty Supply", category: "Оборудование" },
]

export function PartnersPage() {
  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          Партнёрам
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Allure открыт к сотрудничеству. Расскажите, как мы можем быть полезны
          друг другу, и мы вместе придумаем формат партнёрства.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        {/* Форматы сотрудничества */}
        <h2 className="text-3xl font-serif text-foreground mb-8 text-center">
          Как мы можем сотрудничать
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {COOPERATION.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-3xl border border-rose-100 shadow-sm hover:shadow-md transition-shadow p-6 md:p-8"
            >
              <div className="size-12 rounded-full bg-rose-50 text-gold flex items-center justify-center mb-4">
                <item.icon className="size-6 stroke-[1.5]" />
              </div>
              <h3 className="text-xl font-serif text-foreground mb-2">
                {item.title}
              </h3>
              <p className="text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Наши партнёры */}
        <h2 className="text-3xl font-serif text-foreground mb-8 text-center">
          Наши партнёры
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-16">
          {PARTNERS.map((p) => (
            <div
              key={p.name}
              className="flex flex-col items-center text-center bg-white rounded-3xl border border-rose-100 p-6 hover:border-gold/30 transition-colors"
            >
              <div className="size-16 rounded-full bg-rose-50 border border-gold/40 text-gold font-serif text-2xl flex items-center justify-center mb-4">
                {p.name[0]}
              </div>
              <h3 className="font-medium text-foreground">{p.name}</h3>
              <p className="text-sm text-muted-foreground">{p.category}</p>
            </div>
          ))}
        </div>

        {/* Контакт */}
        <div className="bg-rose-50 rounded-3xl border border-rose-100 p-8 md:p-12 text-center">
          <h2 className="text-3xl font-serif text-foreground mb-3">
            Хотите стать партнёром?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Напишите нам коротко о себе и о том, какое сотрудничество вас
            интересует. Мы ответим в течение нескольких рабочих дней.
          </p>
          <a
            href={`mailto:${PARTNERS_EMAIL}?subject=${encodeURIComponent(
              "Предложение о сотрудничестве",
            )}`}
            className="inline-block bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
          >
            Написать нам
          </a>
        </div>
      </div>
    </div>
  )
}