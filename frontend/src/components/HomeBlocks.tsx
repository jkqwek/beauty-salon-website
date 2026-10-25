import { t } from "@/lib/i18n"
import { NavLink } from "react-router"
import { BadgePercent, Info } from "lucide-react"
import { bookingApi, promotionsApi, reviewsApi, type Closure } from "@/api/api"
import { useApi } from "@/api/useApi"
import { formatDayMonth, formatTime } from "@/lib/format"
import { ReviewCard } from "./ReviewCard"

const period = (from: string, to: string) =>
  from === to ? formatDayMonth(from) : `${formatDayMonth(from)} – ${formatDayMonth(to)}`

const closureText = (c: Closure) =>
  c.open_time && c.close_time
    ? t("{period} — {name}: работаем с {from} до {to}", {
        period: period(c.date_from, c.date_to), name: c.name, from: formatTime(c.open_time), to: formatTime(c.close_time),
      })
    : t("{period} салон не работает — {name}", { period: period(c.date_from, c.date_to), name: c.name })

/** Баннер о закрытии или сокращённом дне в ближайшие 7 дней — чтобы никто не пришёл к закрытой двери */
export function ClosureBanner() {
  const { data } = useApi(bookingApi.upcomingClosures)
  if (!data?.length) return null
  return (
    <div role="status" className="bg-rose-100 border-b border-rose-200 text-rose-800 px-6 py-3 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-1">
        {data.map((c) => (
          <p key={`${c.name}-${c.date_from}`} className="flex items-center gap-2">
            <Info className="size-4 shrink-0" /> {closureText(c)}
          </p>
        ))}
      </div>
    </div>
  )
}

/** Акции: действующие и те, что начнутся в ближайшие 14 дней */
export function PromotionsSection({ onBook }: { onBook: () => void }) {
  const { data } = useApi(promotionsApi.current)
  if (!data?.length) return null
  return (
    <section className="py-20 bg-pearl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-gold font-medium tracking-widest uppercase text-sm mb-4 block">{t("Специальные предложения")}</span>
          <h2 className="text-4xl md:text-5xl font-serif text-foreground">{t("Акции")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((p) => (
            <article key={p.id} className="relative bg-white rounded-3xl border border-gold/30 p-8 shadow-sm flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3 className="text-2xl font-serif text-foreground">{p.name}</h3>
                <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-600 text-white font-semibold">
                  <BadgePercent className="size-4" />−{p.discount_percent}%
                </span>
              </div>
              {p.description && <p className="text-muted-foreground mb-4">{p.description}</p>}
              <p className="text-sm text-foreground mb-1">
                {p.services.length ? p.services.map((n) => t(n)).join(", ") : t("На все услуги")}
              </p>
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                {p.is_current ? t("До {date}", { date: formatDayMonth(p.date_to) }) : t("Скоро: {period}", { period: period(p.date_from, p.date_to) })}
              </p>
              <button
                onClick={onBook}
                className="self-start px-6 py-2.5 rounded-full border-2 border-gold text-gold-dark font-medium hover:bg-gold hover:text-white transition-colors"
              >
                {t("Записаться")}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Три свежих отзыва с оценкой от 4 */
export function ReviewsPreview() {
  const { data } = useApi(() => reviewsApi.list({ minRating: 4, limit: 3 }))
  if (!data?.results.length) return null
  return (
    <section className="py-20 bg-pearl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-6">
          <div>
            <span className="text-gold font-medium tracking-widest uppercase text-sm mb-4 block">{t("Нам доверяют")}</span>
            <h2 className="text-4xl md:text-5xl font-serif text-foreground">{t("Отзывы клиентов")}</h2>
          </div>
          <NavLink to="/reviews" className="inline-block px-8 py-3 rounded-full border-2 border-gold text-gold font-medium hover:bg-gold hover:text-white transition-colors">
            {t("Все отзывы")}
          </NavLink>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data.results.map((r) => (
            <ReviewCard key={r.id} review={r} compact />
          ))}
        </div>
      </div>
    </section>
  )
}
