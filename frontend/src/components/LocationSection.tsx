import entrance from "@/imports/entrance.png"
import { ImageWithFallback } from "./ImageWithFallback"
import { MapPin, Clock } from "lucide-react"

export function LocationSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16 w-full">
      <h2 className="text-3xl md:text-4xl font-serif text-foreground mb-8 text-center">
        Как добраться
      </h2>

      <div className="flex flex-col gap-2 items-center text-muted-foreground mb-10">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-gold" /> б-р Строителей, 28/1, Кемерово, Кемеровская обл., 650003
        </p>
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-gold" /> Ежедневно с 9:00 20:30
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl overflow-hidden border border-rose-100 h-80">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d72598.9211688277!2d86.01549029726563!3d55.3454996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x42d808b3676e79d7%3A0xea0c4f53ac1bf873!2sSecret!5e0!3m2!1sru!2sru!4v1791720110758!5m2!1sru!2sru"
            height="100%"
            frameBorder="0"
            allowFullScreen
            title="Карта проезда к салону Allure"
          />
        </div>

        <div className="rounded-3xl overflow-hidden border border-rose-100 h-80">
          <ImageWithFallback
            src={entrance}
            alt="Вход в салон Allure"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </section>
  )
}