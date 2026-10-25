import { t } from "@/lib/i18n"
import { NavLink, useOutletContext } from "react-router"
import { catalogApi } from "@/api/api"
import { useApi } from "@/api/useApi"
import { masterPhoto } from "@/lib/photos"
import { ErrorMessage } from "../components/ErrorMessage"
import { Avatar } from "../components/Avatar"
import { Star } from "lucide-react"
import { ShareButtons } from "../components/ShareButtons"

export function MastersPage() {
  const { openBooking } = useOutletContext<{ openBooking: () => void }>()

  const { data, loading, error, reload } = useApi(() => catalogApi.employees())

  const MASTERS = (data ?? []).map((e) => ({
    id: e.id,
    name: t(e.full_name),
    role: t(e.specialization),
    image: masterPhoto(e) ?? undefined,
    rating: e.rating ? Number(e.rating) : undefined, // средняя оценка клиентов (сайт и бот)
    reviews: e.reviews_count ?? 0,
    quote: undefined as string | undefined, // в БД пока нет
  }))

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">
          {t("Наши мастера")}
        </h1>

        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("Команда отобранных вручную экспертов привносит страсть, точность и артистизм в каждую процедуру.")}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16">
        {loading && (
          <p className="text-center text-muted-foreground">{t("Загрузка…")}</p>
        )}

        {error && <ErrorMessage error={error} onRetry={reload} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {MASTERS.map((master) => (
            <div
              key={master.id}
              className="flex flex-col items-center bg-white rounded-3xl p-8 border border-rose-100 shadow-sm hover:shadow-xl hover:border-gold/30 transition-all duration-300 group"
            >
              <div className="size-48 rounded-full p-2 border border-gold mb-6 relative">
                {master.rating && (
                  <div className="absolute -top-3 -right-3 bg-white p-2 rounded-full shadow-sm">
                    <div className="flex items-center gap-1 bg-rose-50 px-3 py-1 rounded-full text-gold font-medium text-sm">
                      <Star className="size-4 fill-gold text-gold" />
                      {master.rating}
                    </div>
                  </div>
                )}

                <div className="size-full rounded-full overflow-hidden bg-rose-100">
                  <Avatar
                    src={master.image}
                    name={master.name}
                    className="size-full text-5xl font-serif group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>

              <h3 className="text-2xl font-serif text-foreground mb-1">
                {master.name}
              </h3>

              <p className="text-sm font-medium text-gold/80 mb-2">
                {master.role}
              </p>

              {master.reviews > 0 ? (
                <NavLink to={`/reviews?master=${master.id}`} className="text-sm text-gold-dark hover:underline mb-4">
                  {t("Отзывы")} ({master.reviews})
                </NavLink>
              ) : (
                <span className="mb-4" />
              )}

              <p className="text-muted-foreground text-center text-sm italic mb-8 flex-1">
                {master.quote && `"${master.quote}"`}
              </p>

              <div className="mb-4">
                <ShareButtons
                  url={`${window.location.origin}/masters`}
                  title={master.name}
                />
              </div>

              <button
                onClick={openBooking}
                className="w-full border-2 border-gold text-gold font-medium hover:bg-gold hover:text-white px-6 py-3 rounded-full transition-colors"
              >
                {t("Профиль / Записаться")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
