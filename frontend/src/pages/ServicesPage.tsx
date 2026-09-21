import { useState } from "react"
import { useOutletContext } from "react-router"
import heroPhoto from "@/imports/image-1.png"
import detailPhoto from "@/imports/image-1.png"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { Clock } from "lucide-react"

const CATEGORIES = ["Все", "Волосы", "Ногти", "Кожа", "Массаж"]

const SERVICES = [
  {
    id: 1,
    category: "Волосы",
    name: "Балаяж и укладка",
    desc: "Окрашивание прядей вручную для естественного выгоревшего эффекта и объёмная укладка в финале.",
    time: "120 мин",
    price: "14 500 ₽",
  },
  {
    id: 2,
    category: "Волосы",
    name: "Авторская стрижка",
    desc: "Точная стрижка с учётом формы лица и образа жизни.",
    time: "60 мин",
    price: "4 500 ₽",
  },
  {
    id: 3,
    category: "Ногти",
    name: "Наращивание гелем",
    desc: "Стойкое моделирующее наращивание с индивидуальным дизайном.",
    time: "90 мин",
    price: "4 200 ₽",
  },
  {
    id: 4,
    category: "Ногти",
    name: "Классический маникюр",
    desc: "Базовый уход за ногтями, работа с кутикулой и безупречное покрытие.",
    time: "45 мин",
    price: "2 800 ₽",
  },
  {
    id: 5,
    category: "Кожа",
    name: "Увлажняющий уход за лицом",
    desc: "Глубокое очищение, отшелушивание и интенсивное увлажнение.",
    time: "60 мин",
    price: "6 500 ₽",
  },
  {
    id: 6,
    category: "Кожа",
    name: "Химический пилинг",
    desc: "Продвинутое обновление кожи для сияющего результата.",
    time: "45 мин",
    price: "7 900 ₽",
  },
  {
    id: 7,
    category: "Массаж",
    name: "Шведский массаж",
    desc: "Расслабляющий массаж всего тела, снимающий напряжение.",
    time: "60 мин",
    price: "5 500 ₽",
  },
  {
    id: 8,
    category: "Массаж",
    name: "Глубокий массаж",
    desc: "Прицельная работа с мышечными зажимами и хронической болью.",
    time: "90 мин",
    price: "8 200 ₽",
  },
]

export function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState("Все")
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  const filteredServices =
    activeCategory === "Все"
      ? SERVICES
      : SERVICES.filter((s) => s.category === activeCategory)

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          Наши услуги
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Загляните в меню роскошных процедур, созданных, чтобы поднять вашу
          красоту и заботу о себе на новый уровень.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
                activeCategory === cat
                  ? "bg-gold text-white border-gold shadow-md"
                  : "bg-white text-muted-foreground border-rose-200 hover:border-gold/50 hover:text-gold"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex flex-col gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden border border-rose-100 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="w-full md:w-64 h-48 md:h-auto overflow-hidden">
                <ImageWithFallback
                  src={
                    service.category === "Волосы" || service.category === "Кожа"
                      ? detailPhoto
                      : heroPhoto
                  }
                  alt={service.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>

              <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-2 gap-4">
                  <h3 className="text-2xl font-serif text-foreground">
                    {service.name}
                  </h3>
                  <span className="text-xl font-medium text-gold shrink-0">
                    {service.price}
                  </span>
                </div>

                <p className="text-muted-foreground mb-6 line-clamp-2 md:line-clamp-none">
                  {service.desc}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="size-4" /> {service.time}
                  </div>
                  <button
                    onClick={openBooking}
                    className="bg-white border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-colors"
                  >
                    Выбрать
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
