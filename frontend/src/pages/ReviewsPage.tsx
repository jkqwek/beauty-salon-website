import { t } from "@/lib/i18n"
import { useSearchParams } from "react-router"
import { catalogApi, reviewsApi } from "@/api/api"
import { useApi } from "@/api/useApi"
import { plural } from "@/lib/format"
import { ErrorMessage } from "../components/ErrorMessage"
import { ReviewCard } from "../components/ReviewCard"
import { StarRating } from "../components/StarRating"

const chipCls = (active: boolean) =>
  `px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
    active ? "bg-gold text-white border-gold" : "bg-white text-muted-foreground border-rose-200 hover:border-gold hover:text-foreground"
  }`

export function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const master = params.get("master") ? Number(params.get("master")) : null // /reviews?master=3 — с карточки мастера
  const reviews = useApi(() => reviewsApi.list({ employee: master }), [master])
  const masters = useApi(() => catalogApi.employees())
  const withReviews = (masters.data ?? []).filter((m) => m.reviews_count)

  return (
    <div className="flex-1 bg-pearl pb-24">
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">{t("Отзывы")}</h1>
        {reviews.data && reviews.data.count > 0 && (
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <span className="text-3xl font-serif text-foreground">
              {reviews.data.average?.toFixed(1).replace(".", ",")}
            </span>
            <StarRating value={Math.round(reviews.data.average ?? 0)} size="size-5" />
            <span>{plural(reviews.data.count, ["отзыв", "отзыва", "отзывов"])}</span>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 pt-10">
        {withReviews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={() => setParams({})} aria-pressed={master === null} className={chipCls(master === null)}>
              {t("Все мастера")}
            </button>
            {withReviews.map((m) => (
              <button
                key={m.id}
                onClick={() => setParams({ master: String(m.id) })}
                aria-pressed={master === m.id}
                className={chipCls(master === m.id)}
              >
                {m.full_name} <span className="opacity-70">{m.reviews_count}</span>
              </button>
            ))}
          </div>
        )}

        {reviews.loading && !reviews.data && <p className="text-muted-foreground">{t("Загрузка…")}</p>}
        {reviews.error && <ErrorMessage error={reviews.error} onRetry={reviews.reload} />}
        {reviews.data?.count === 0 && (
          <p className="text-muted-foreground text-center">
            {t("Отзывов пока нет. Поделиться впечатлениями можно в личном кабинете после визита.")}
          </p>
        )}
        <div className="space-y-6">
          {reviews.data?.results.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      </div>
    </div>
  )
}
