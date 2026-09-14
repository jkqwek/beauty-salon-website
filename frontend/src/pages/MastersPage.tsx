import { useOutletContext } from "react-router"
import photoRostova from "@/imports/Rostova.png"
import photoLin from "@/imports/lin.png"
import photoKravtsova from "@/imports/kravchova.png"
import photoTarasov from "@/imports/tarasov.png"
import photoVishnevskaya from "@/imports/vishnevskaya.png"
import photoKim from "@/imports/kim.png"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { Star } from "lucide-react"

const MASTERS = [
  {
    id: 1,
    name: "Елена Ростова",
    role: "Ведущий стилист-колорист",
    rating: 5.0,
    quote: "Каждый клиент — холст, а цвет — мой любимый материал.",
    image: photoRostova,
  },
  {
    id: 2,
    name: "София Лин",
    role: "Главный косметолог",
    rating: 4.9,
    quote: "Сияющая кожа начинается с глубокого ухода и расслабления.",
    image: photoLin,
  },
  {
    id: 3,
    name: "Злата Кравцова",
    role: "Мастер нейл-арта",
    rating: 4.9,
    quote: "Детали создают совершенство, а совершенство — не деталь.",
    image: photoKravtsova,
  },
  {
    id: 4,
    name: "Богдан Тарасов",
    role: "Массажист",
    rating: 5.0,
    quote: "Исцеление тела через осознанное прикосновение и энергию.",
    image: photoTarasov,
  },
  {
    id: 5,
    name: "Дарина Вишневская",
    role: "Визажист",
    rating: 4.8,
    quote: "Подчёркиваю вашу естественную красоту для любого повода.",
    image: photoVishnevskaya,
  },
  {
    id: 6,
    name: "Дэвид Ким",
    role: "Парикмахер-стилист",
    rating: 4.9,
    quote: "Хорошая стрижка меняет взгляд на себя.",
    image: photoKim,
  },
]

export function MastersPage() {
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          Наши мастера
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Команда отобранных вручную экспертов привносит страсть, точность и
          артистизм в каждую процедуру.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {MASTERS.map((master) => (
            <div
              key={master.id}
              className="flex flex-col items-center bg-white rounded-3xl p-8 border border-rose-100 shadow-sm hover:shadow-xl hover:border-gold/30 transition-all duration-300 group"
            >
              <div className="size-48 rounded-full p-2 border border-gold mb-6 relative">
                <div className="absolute -top-3 -right-3 bg-white p-2 rounded-full shadow-sm">
                  <div className="flex items-center gap-1 bg-rose-50 px-3 py-1 rounded-full text-gold font-medium text-sm">
                    <Star className="size-4 fill-gold text-gold" />
                    {master.rating}
                  </div>
                </div>
                <div className="size-full rounded-full overflow-hidden bg-rose-100">
                  <ImageWithFallback
                    src={master.image}
                    alt={master.name}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>

              <h3 className="text-2xl font-serif text-foreground mb-1">
                {master.name}
              </h3>
              <p className="text-sm font-medium text-gold/80 mb-4">
                {master.role}
              </p>

              <p className="text-muted-foreground text-center text-sm italic mb-8 flex-1">
                "{master.quote}"
              </p>

              <button
                onClick={openBooking}
                className="w-full border-2 border-gold text-gold font-medium hover:bg-gold hover:text-white px-6 py-3 rounded-full transition-colors"
              >
                Профиль / Записаться
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
