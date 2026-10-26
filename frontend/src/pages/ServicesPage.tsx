import { t } from "@/lib/i18n"
import { useEffect, useState } from "react"
import { useOutletContext } from "react-router"
import heroPhoto from "@/imports/image-1.png"
import detailPhoto from "@/imports/image-1.png"
import { catalogApi, SERVICE_TAGS, type ServiceTag } from "@/api/api"
import { useApi } from "@/api/useApi"
import { useCompare } from "@/lib/compare"
import { formatDuration } from "@/lib/format"
import { useHighlight } from "@/lib/highlight"
import { PriceTag } from "../components/PriceTag"
import { ErrorMessage } from "../components/ErrorMessage"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { Check, Clock, Download, Scale } from "lucide-react"
import { ShareButtons } from "../components/ShareButtons"
import { TagChips, tagName } from "../components/TagChips"
import { toast } from "../components/Toast"

const CATEGORIES = ["Все", "Волосы", "Ногти", "Кожа", "Массаж"]

export function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState("Все")
  const [activeTag, setActiveTag] = useState<ServiceTag | null>(null) // один тег за раз, вместе с категорией
  const compare = useCompare()
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  const { data, loading, error, reload } = useApi(catalogApi.services)

  const services = (data ?? []).map((s) => ({
    id: s.id,
    category: s.category,
    name: t(s.name),
    desc: t(s.description),
    time: formatDuration(s.duration_minutes),
    price: s.price,
    priceToday: s.price_today,
    discount: s.discount_percent,
    image: s.image, // <-- картинка из API
    tags: s.tags,
  }))

  const filteredServices = services.filter(
    (s) => (activeCategory === "Все" || s.category === activeCategory) && (!activeTag || s.tags.includes(activeTag)),
  )
  // в ряду фильтра — только теги, которые есть у услуг, в порядке общего списка
  const usedTags = (Object.keys(SERVICE_TAGS) as ServiceTag[]).filter((tag) => services.some((s) => s.tags.includes(tag)))
  const pickTag = (tag: ServiceTag) => setActiveTag(activeTag === tag ? null : tag)

  // переход из поиска: если карточку скрывают фильтры — сначала показываем все услуги
  const { target, active } = useHighlight("service", (id) => filteredServices.some((s) => s.id === id))
  useEffect(() => {
    if (target && !filteredServices.some((s) => s.id === target)) {
      setActiveCategory("Все")
      setActiveTag(null)
    }
  }, [target, data])

  const toggleCompare = (id: number) => {
    if (!compare.toggle(id)) toast(t("Сравнить можно не больше 4 услуг. Уберите одну из сравнения."))
  }

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          {t("Наши услуги")}
        </h1>

        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("Загляните в меню роскошных процедур, созданных, чтобы поднять вашу красоту и заботу о себе на новый уровень.")}
        </p>

        <a
          href="/price-list.pdf"
          download="Allure-price-list.pdf"
          className="inline-flex items-center gap-2 mt-6 border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
        >
          <Download className="size-4" />
          {t("Скачать прайс-лист")}
        </a>
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
              {t(cat)}
            </button>
          ))}
        </div>

        {usedTags.length > 0 && (
          <div className="flex flex-wrap justify-center items-center gap-2 -mt-10 mb-16">
            <span className="text-sm text-muted-foreground mr-1">{t("Теги:")}</span>
            {usedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => pickTag(tag)}
                aria-pressed={activeTag === tag}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  activeTag === tag
                    ? "bg-gold text-white border-gold"
                    : "bg-gold/5 text-gold-dark border-gold/30 hover:border-gold"
                }`}
              >
                {tagName(tag)}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p className="text-center text-muted-foreground">{t("Загрузка…")}</p>
        )}

        {error && <ErrorMessage error={error} onRetry={reload} />}

        {!loading && !error && filteredServices.length === 0 && (
          <p className="text-center text-muted-foreground">
            {activeTag ? t("Нет услуг с такими фильтрами.") : t("В этой категории пока нет услуг.")}
          </p>
        )}

        {/* List */}
        <div className="flex flex-col gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              id={`service-${service.id}`}
              className={`flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden border border-rose-100 shadow-sm hover:shadow-md transition-shadow group${
                active === service.id ? " ring-2 ring-gold ring-offset-4 ring-offset-pearl" : ""
              }`}
            >
              <div className="w-full md:w-64 h-48 md:h-auto overflow-hidden">
                <ImageWithFallback
                  src={
                    service.image ??
                    (service.category === "Волосы" || service.category === "Кожа"
                      ? detailPhoto
                      : heroPhoto)
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

                  <PriceTag
                    base={service.price}
                    price={service.priceToday}
                    discount={service.discount}
                    className="text-xl font-medium text-gold-dark shrink-0 justify-end"
                  />
                </div>

                <div className="mb-3">
                  <TagChips tags={service.tags} active={activeTag} onPick={pickTag} />
                </div>

                <p className="text-muted-foreground mb-6 line-clamp-2 md:line-clamp-none">
                  {service.desc}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="size-4" /> {service.time}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleCompare(service.id)}
                      aria-pressed={compare.has(service.id)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        compare.has(service.id)
                          ? "bg-gold/10 border-gold text-gold-dark"
                          : "border-rose-200 text-muted-foreground hover:border-gold hover:text-gold-dark"
                      }`}
                    >
                      {compare.has(service.id) ? <Check className="size-4" /> : <Scale className="size-4" />}
                      {compare.has(service.id) ? t("В сравнении") : t("Сравнить")}
                    </button>
                    <button
                      onClick={openBooking}
                      className="bg-white border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-colors"
                    >
                      {t("Выбрать")}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <ShareButtons
                    url={`${window.location.origin}/services`}
                    title={service.name}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}