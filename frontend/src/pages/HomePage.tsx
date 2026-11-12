import { t } from "@/lib/i18n"
import { useEffect, useState } from "react"
import { NavLink, useOutletContext } from "react-router"
import heroPhoto from "@/imports/back.png"
import {
  ArrowRight,
  Droplets,
  Scissors,
  Sparkles,
  UserCircle2,
  type LucideIcon,
} from "lucide-react"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { LocationSection } from "../components/LocationSection"
import { FaqSection } from "../components/FaqSection"
import { Reveal } from "../components/Reveal"
import { WorksSlider, type Work } from "../components/WorksSlider"
import {
  ClosureBanner,
  PromotionsSection,
  ReviewsPreview,
} from "../components/HomeBlocks"

// --- Типы (подправьте под реальные поля сериализаторов) ---
type Service = {
  id: number
  name: string
  description?: string | null
  category?: string | null
  image?: string | null
}

type Master = {
  id: number
  name?: string | null
  full_name?: string | null
  role?: string | null
  position?: string | null
  specialization?: string | null
  photo?: string | null
  image?: string | null
}

// --- Вспомогательные функции ---

// DRF может вернуть либо массив, либо { count, next, previous, results: [...] }
function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { results?: unknown }).results)
  ) {
    return (payload as { results: T[] }).results
  }
  return []
}

// Подбор иконки по названию/категории услуги
function iconForService(service: Service): LucideIcon {
  const key = `${service.name ?? ""} ${service.category ?? ""}`.toLowerCase()
  if (key.includes("волос") || key.includes("стриж") || key.includes("окраш"))
    return Scissors
  if (key.includes("ногт") || key.includes("маник") || key.includes("педик"))
    return Sparkles
  if (key.includes("массаж")) return UserCircle2
  if (key.includes("кож") || key.includes("чистк") || key.includes("пилин"))
    return Droplets
  return Sparkles
}

function masterName(m: Master): string {
  return t(m.name || m.full_name || "Без имени")
}

function masterRole(m: Master): string {
  return t(m.role || m.position || m.specialization || "")
}

function masterPhoto(m: Master): string | undefined {
  return m.photo || m.image || undefined
}

/** Специализации мастера: «Барбер, массажист» -> ["Барбер", "Массажист"] — фильтр находит его по каждой */
function specialties(m: Master): string[] {
  return (m.role || m.position || m.specialization || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
}

// Замените картинки на настоящие фото работ из @/imports/works/..., когда они будут
const WORKS: Work[] = [
  { image: heroPhoto, title: "Окрашивание в холодный блонд", master: "Елена Ростова" },
  { image: heroPhoto, title: "Уход за лицом", master: "София Лин" },
  { image: heroPhoto, title: "Маникюр с дизайном", master: "Злата Кравцова" },
  { image: heroPhoto, title: "Расслабляющий массаж", master: "Богдан Тарасов" },
]

const API_BASE = "/api"

export function HomePage() {
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  const [services, setServices] = useState<Service[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingMasters, setLoadingMasters] = useState(true)
  const [specialty, setSpecialty] = useState<string | null>(null) // ключ в нижнем регистре, null — все

  // кнопки фильтра: уникальные специализации без учёта регистра, в порядке появления
  const specialtyOptions = new Map<string, string>()
  for (const m of masters)
    for (const s of specialties(m))
      if (!specialtyOptions.has(s.toLowerCase())) specialtyOptions.set(s.toLowerCase(), s)
  const shownMasters = specialty
    ? masters.filter((m) => specialties(m).some((s) => s.toLowerCase() === specialty))
    : masters
  const chipCls = (active: boolean) =>
    `px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
      active
        ? "bg-gold text-white border-gold shadow-sm"
        : "bg-white text-muted-foreground border-rose-200 hover:border-gold/50 hover:text-gold"
    }`

  useEffect(() => {
    let alive = true

    fetch(`${API_BASE}/services/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (alive) setServices(unwrapList<Service>(data))
      })
      .catch((err) => console.error("Не удалось загрузить услуги:", err))
      .finally(() => {
        if (alive) setLoadingServices(false)
      })

    fetch(`${API_BASE}/employees/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (alive) setMasters(unwrapList<Master>(data))
      })
      .catch((err) => console.error("Не удалось загрузить мастеров:", err))
      .finally(() => {
        if (alive) setLoadingMasters(false)
      })

    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="flex flex-col flex-1">
      <ClosureBanner />

      {/* Hero Section (без анимации: первый экран должен быть виден сразу) */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src={heroPhoto}
            alt={t("Роскошный интерьер салона Allure с мягким светом и элегантной мебелью")}
            className="w-full h-full object-cover blur-[2px]"
          />
          <div className="absolute inset-0 bg-black/55"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-pearl to-transparent to-30%"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* на тёмной подложке нужен светлый text-gold, а не gold-dark */}
          <span className="inline-block px-4 py-1 mb-6 rounded-full border border-gold/70 text-gold font-medium text-sm tracking-widest uppercase">
            {t("Добро пожаловать в Allure")}
          </span>
          <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-serif text-white mb-6 leading-[1.1] tracking-tight">
            {t("Перезагрузка")} <br />
            <span className="text-gold-gradient italic">{t("за один визит.")}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 font-medium leading-relaxed text-pretty">
            {t("Погрузитесь в мир изысканного ухода — в спокойном современном пространстве, созданном исключительно для вашего благополучия.")}
          </p>
          <button
            onClick={openBooking}
            className="bg-gradient-to-br from-gold to-gold-hover hover:brightness-105 text-white px-10 py-4 rounded-full text-lg font-semibold hover:shadow-[0_10px_30px_rgba(212,175,55,0.3)] hover:-translate-y-1 transition-all duration-300"
          >
            {t("Записаться")}
          </button>
        </div>
      </section>

      <PromotionsSection onBook={openBooking} />

      {/* Services Preview */}
      <section className="section-y bg-pearl relative">
        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-100 rounded-full blur-3xl opacity-40 -translate-x-1/2 -translate-y-1/2"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <Reveal>
            <div className="flex flex-col md:flex-row items-end justify-between mb-12 md:mb-16 gap-6">
              <div>
                <h2 className="section-title mb-4">{t("Наши услуги")}</h2>
                <p className="section-lead">
                  {t("Тщательно подобранные процедуры, которые подчеркнут вашу естественную красоту и подарят полное расслабление.")}
                </p>
              </div>
              <NavLink
                to="/services"
                className="text-gold-dark font-medium flex items-center gap-2 hover:gap-3 transition-all hover:text-gold-hover"
              >
                {t("Все услуги")} <ArrowRight className="size-4" />
              </NavLink>
            </div>
          </Reveal>

          {loadingServices ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center p-8 rounded-3xl bg-white border border-rose-100 animate-pulse"
                >
                  <div className="size-16 rounded-full bg-rose-50 mb-6" />
                  <div className="h-5 w-24 bg-rose-50 rounded mb-2" />
                  <div className="h-3 w-32 bg-rose-50 rounded" />
                </div>
              ))}
            </div>
          ) : services.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("Услуги скоро появятся.")}
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {services.map((service, i) => {
                const Icon = iconForService(service)
                return (
                  // задержка по кругу в пределах ряда: карточки не ждут по секунде
                  <Reveal key={service.id} delay={(i % 4) * 80} className="h-full">
                    <div className="group flex flex-col items-center text-center p-8 rounded-3xl bg-white border border-rose-100 shadow-sm hover:shadow-lg hover:border-gold/30 transition-all duration-300 cursor-pointer h-full">
                      <div className="size-16 rounded-full bg-rose-50 text-gold-dark flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Icon className="size-8 stroke-[1.5]" />
                      </div>
                      <h3 className="text-xl font-serif text-foreground mb-2">
                        {t(service.name)}
                      </h3>
                      {service.description && (
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Meet the Masters */}
      <section className="section-y bg-rose-50 border-y border-rose-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="section-title mb-4">{t("Наши мастера")}</h2>
              <p className="section-lead mx-auto">
                {t("Команда титулованных профессионалов, готовых воплотить вашу идею.")}
              </p>
            </div>
          </Reveal>

          {masters.length >= 2 && specialtyOptions.size >= 2 && (
            <div
              className="flex flex-wrap justify-center gap-2 -mt-8 mb-12"
              role="group"
              aria-label={t("Специализация мастера")}
            >
              <button onClick={() => setSpecialty(null)} aria-pressed={specialty === null} className={chipCls(specialty === null)}>
                {t("Все")}
              </button>
              {[...specialtyOptions].map(([key, label]) => (
                <button key={key} onClick={() => setSpecialty(key)} aria-pressed={specialty === key} className={chipCls(specialty === key)}>
                  {t(label)}
                </button>
              ))}
            </div>
          )}

          {/* карусель оборачиваем целиком: карточки лежат в горизонтальной прокрутке */}
          <Reveal delay={100}>
            {loadingMasters ? (
              <div className="flex overflow-x-auto pb-10 -mx-6 px-6 gap-8 snap-x hide-scrollbar">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="snap-center shrink-0 w-[280px] flex flex-col items-center"
                  >
                    <div className="size-48 rounded-full bg-rose-100 mb-6 animate-pulse" />
                    <div className="h-6 w-40 bg-rose-100 rounded mb-2" />
                    <div className="h-4 w-32 bg-rose-100 rounded" />
                  </div>
                ))}
              </div>
            ) : masters.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t("Информация о мастерах скоро появится.")}
              </p>
            ) : (
              <div className="flex overflow-x-auto pb-10 -mx-6 px-6 gap-8 snap-x hide-scrollbar">
                {shownMasters.map((master) => {
                  const photo = masterPhoto(master)
                  return (
                    <div
                      key={master.id}
                      className="snap-center shrink-0 w-[280px] flex flex-col items-center group cursor-pointer"
                    >
                      <div className="size-48 rounded-full p-3 border-2 border-transparent group-hover:border-gold transition-colors duration-500 mb-6">
                        <div className="size-full rounded-full overflow-hidden bg-rose-100 relative">
                          {photo ? (
                            <ImageWithFallback
                              src={photo}
                              alt={masterName(master)}
                              className="size-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 pointer-coarse:grayscale-0 pointer-coarse:opacity-100 transition-all duration-500"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center text-rose-300">
                              <UserCircle2 className="size-20 stroke-[1]" />
                            </div>
                          )}
                        </div>
                      </div>
                      <h3 className="text-2xl font-serif text-foreground mb-1 group-hover:text-gold-dark transition-colors">
                        {masterName(master)}
                      </h3>
                      {masterRole(master) && (
                        <p className="text-sm font-medium text-gold-dark">
                          {masterRole(master)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Reveal>

          <div className="text-center mt-4">
            <NavLink
              to="/masters"
              className="inline-block px-8 py-3 rounded-full border-2 border-gold text-gold-dark font-medium hover:bg-gold hover:text-white transition-colors"
            >
              {t("Вся команда")}
            </NavLink>
          </div>
        </div>
      </section>

      {/* Работы мастеров */}
      <section className="section-y bg-pearl">
        <div className="max-w-7xl mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12 md:mb-16">
              <h2 className="section-title mb-4">{t("Работы наших мастеров")}</h2>
              <p className="section-lead mx-auto">
                {t("Несколько историй, которыми мы гордимся.")}
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <WorksSlider works={WORKS} />
          </Reveal>
        </div>
      </section>

      <ReviewsPreview />

      {/* FAQ */}
      <Reveal>
        <FaqSection />
      </Reveal>

      {/* Как добраться */}
      <Reveal>
        <LocationSection />
      </Reveal>
    </div>
  )
}