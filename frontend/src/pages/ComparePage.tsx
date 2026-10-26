import { useEffect, type ReactNode } from "react"
import { NavLink, useNavigate, useOutletContext, useSearchParams } from "react-router"
import { ArrowLeft, X } from "lucide-react"
import fallbackPhoto from "@/imports/image-1.png"
import { catalogApi, type Service } from "@/api/api"
import { useApi } from "@/api/useApi"
import { useCompare } from "@/lib/compare"
import { formatDuration } from "@/lib/format"
import { t } from "@/lib/i18n"
import type { BookingPrefill } from "../components/BookingWizard"
import { ErrorMessage } from "../components/ErrorMessage"
import { ImageWithFallback } from "../components/ImageWithFallback"
import { PriceTag } from "../components/PriceTag"
import { TagChips } from "../components/TagChips"

// закреплённая колонка с названиями строк; рамки ячеек раздельные — со слитными Chrome рисует
// закреплённые ячейки с артефактами
const STICKY = "sticky left-0 z-10 bg-white p-3 md:p-4 shadow-[4px_0_6px_-4px_rgba(0,0,0,0.12)]"

const best = (label: string) => (
  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold-dark text-xs font-medium">{label}</span>
)

/** Сравнение до 4 услуг: колонки — услуги, строки — цена, длительность, мастера и т.д. */
export function ComparePage() {
  const { rebook } = useOutletContext<{ rebook: (p: BookingPrefill) => void }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { ids, remove, replace } = useCompare()
  const services = useApi(catalogApi.services)
  const masters = useApi(() => catalogApi.employees())

  // ссылка ?ids=1,3 (например, присланная) задаёт выбор при открытии
  useEffect(() => {
    const fromUrl = (params.get("ids") ?? "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0)
    if (fromUrl.length) replace(fromUrl)
  }, [])
  // адрес повторяет выбор — сравнением можно поделиться
  useEffect(() => {
    navigate(ids.length ? `/compare?ids=${ids.join(",")}` : "/compare", { replace: true }) // запятые без %2C
  }, [ids])

  const chosen = ids.map((id) => services.data?.find((s) => s.id === id)).filter((s): s is Service => Boolean(s))
  // услугу убрали из каталога — убираем и из сравнения
  useEffect(() => {
    if (services.data && chosen.length !== ids.length) replace(chosen.map((s) => s.id))
  }, [services.data, ids])

  const prices = chosen.map((s) => Number(s.price_today))
  const durations = chosen.map((s) => s.duration_minutes)
  // подсвечиваем лучшее, только если есть из чего выбирать
  const isBest = (values: number[], value: number) => values.length > 1 && new Set(values).size > 1 && value === Math.min(...values)
  const mastersOf = (s: Service) =>
    (masters.data ?? []).filter((m) => m.services.includes(s.id)).map((m) => t(m.full_name))

  const rows: { label: string; cell: (s: Service) => ReactNode }[] = [
    {
      label: t("Фото"),
      cell: (s) => (
        <ImageWithFallback src={s.image ?? fallbackPhoto} alt={t(s.name)} className="w-full aspect-[4/3] object-cover rounded-2xl" />
      ),
    },
    {
      label: t("Цена сегодня"),
      cell: (s) => (
        <>
          <PriceTag base={s.price} price={s.price_today} discount={s.discount_percent} className="text-lg font-medium text-foreground" />
          {isBest(prices, Number(s.price_today)) && best(t("Дешевле всех"))}
        </>
      ),
    },
    {
      label: t("Длительность"),
      cell: (s) => (
        <>
          <span className="text-foreground">{formatDuration(s.duration_minutes)}</span>
          {isBest(durations, s.duration_minutes) && <div>{best(t("Быстрее всех"))}</div>}
        </>
      ),
    },
    { label: t("Категория"), cell: (s) => (s.category ? t(s.category) : "—") },
    { label: t("Теги"), cell: (s) => (s.tags.length ? <TagChips tags={s.tags} /> : "—") },
    {
      label: t("Мастера"),
      cell: (s) => (masters.data ? mastersOf(s).join(", ") || "—" : "…"),
    },
    { label: t("Описание"), cell: (s) => <p className="text-muted-foreground whitespace-pre-line">{s.description ? t(s.description) : "—"}</p> },
    {
      label: "",
      cell: (s) => (
        <button
          onClick={() => rebook({ serviceId: s.id })}
          className="w-full bg-gold hover:bg-gold-hover text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
        >
          {t("Записаться")}
        </button>
      ),
    },
  ]

  const toServices = (
    <NavLink to="/services" className="inline-flex items-center gap-2 text-gold-dark font-medium hover:underline">
      <ArrowLeft className="size-4" /> {t("К услугам")}
    </NavLink>
  )

  return (
    <div className="flex-1 bg-pearl pb-24">
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">{t("Сравнение услуг")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("До 4 услуг рядом: цена, длительность, мастера и теги. Добавляйте услуги кнопкой «Сравнить» на странице «Услуги».")}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10 space-y-6">
        {services.error && <ErrorMessage error={services.error} onRetry={services.reload} />}
        {services.loading && !services.data && <p className="text-muted-foreground">{t("Загрузка…")}</p>}

        {services.data && chosen.length === 0 && (
          <div className="bg-white rounded-3xl border border-rose-100 p-10 text-center space-y-4">
            <p className="text-muted-foreground">{t("Вы ещё не выбрали услуги. Нажмите «Сравнить» на карточках услуг.")}</p>
            <NavLink to="/services" className="inline-block bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors">
              {t("Перейти к услугам")}
            </NavLink>
          </div>
        )}

        {chosen.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              {toServices}
              {chosen.length === 1 && <p className="text-sm text-muted-foreground">{t("Добавьте ещё хотя бы одну услугу, чтобы сравнить.")}</p>}
            </div>

            {/* на телефоне таблица листается вбок, названия строк закреплены */}
            <div className="overflow-x-auto bg-white rounded-3xl border border-rose-100 shadow-sm">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className={`${STICKY} w-28 md:w-40`} />
                    {chosen.map((s) => (
                      <th key={s.id} scope="col" className="p-3 md:p-4 align-top text-left min-w-56">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xl font-serif font-normal text-foreground">{t(s.name)}</span>
                          <button
                            onClick={() => remove(s.id)}
                            title={t("Убрать из сравнения")}
                            aria-label={t("Убрать из сравнения")}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-rose-600 hover:bg-rose-50 shrink-0"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <th scope="row" className={`${STICKY} border-t border-rose-50 text-left align-top font-medium text-muted-foreground`}>
                        {row.label}
                      </th>
                      {chosen.map((s) => (
                        <td key={s.id} className="p-3 md:p-4 align-top border-t border-rose-50">
                          {row.cell(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
