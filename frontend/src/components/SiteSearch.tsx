import { useEffect, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router"
import { Scissors, Search, X } from "lucide-react"
import { catalogApi, SERVICE_TAGS } from "@/api/api"
import { useApi } from "@/api/useApi"
import { formatPrice } from "@/lib/format"
import { t } from "@/lib/i18n"
import { masterPhoto } from "@/lib/photos"
import { Avatar } from "./Avatar"
import { ErrorMessage } from "./ErrorMessage"

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/ё/g, "е")

interface Result {
  key: string
  to: string
  title: string
  subtitle: string
  image: string | null
  isMaster: boolean
}

/** Поиск по услугам (название, описание, категория, теги) и мастерам. Каталог небольшой —
 *  фильтруем в браузере уже загруженные списки, по-русски и на текущем языке сайта */
export function SiteSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const services = useApi(catalogApi.services)
  const masters = useApi(() => catalogApi.employees())
  const [query, setQuery] = useState("")
  const q = norm(query.trim())

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const has = (...fields: (string | null | undefined)[]) => fields.some((f) => norm(f).includes(q) || norm(t(f ?? "")).includes(q))
  const foundServices: Result[] = q
    ? (services.data ?? [])
        .filter((s) => has(s.name, s.description, s.category, ...s.tags.map((tag) => SERVICE_TAGS[tag])))
        .map((s) => ({
          key: `s${s.id}`,
          to: `/services?service=${s.id}`,
          title: t(s.name),
          subtitle: [s.category && t(s.category), formatPrice(s.price_today)].filter(Boolean).join(" · "),
          image: s.image,
          isMaster: false,
        }))
    : []
  const foundMasters: Result[] = q
    ? (masters.data ?? [])
        .filter((m) => has(m.full_name, m.specialization))
        .map((m) => ({
          key: `m${m.id}`,
          to: `/masters?master=${m.id}`,
          title: t(m.full_name),
          subtitle: t(m.specialization),
          image: masterPhoto(m),
          isMaster: true,
        }))
    : []
  const first = foundServices[0] ?? foundMasters[0]

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && first) go(first.to)
  }

  const group = (title: string, items: Result[]) =>
    items.length > 0 && (
      <section>
        <h3 className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h3>
        {items.map((r) => (
          <button
            key={r.key}
            onClick={() => go(r.to)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left hover:bg-rose-50 focus:bg-rose-50 focus:outline-none transition-colors ${
              r === first ? "bg-rose-50/60" : ""
            }`}
          >
            {r.isMaster ? (
              <Avatar src={r.image} name={r.title} className="size-11 text-sm shrink-0" />
            ) : r.image ? (
              <img src={r.image} alt="" className="size-11 rounded-xl object-cover shrink-0" />
            ) : (
              <span className="size-11 rounded-xl bg-rose-50 text-gold flex items-center justify-center shrink-0">
                <Scissors className="size-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block font-medium text-foreground truncate">{r.title}</span>
              <span className="block text-sm text-muted-foreground truncate">{r.subtitle}</span>
            </span>
          </button>
        ))}
      </section>
    )

  const loading = services.loading || masters.loading
  const error = services.error ?? masters.error

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20 sm:pt-28 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Поиск по сайту")}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 border-b border-rose-100">
          <Search className="size-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onEnter}
            placeholder={t("Услуга, тег или мастер")}
            aria-label={t("Услуга, тег или мастер")}
            className="flex-1 py-5 bg-transparent text-lg focus:outline-none"
          />
          <button onClick={onClose} aria-label={t("Закрыть поиск")} className="p-2 text-muted-foreground hover:text-foreground bg-rose-50 rounded-full">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {error && <ErrorMessage error={error} onRetry={() => (services.reload(), masters.reload())} />}
          {!q && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Например: «стрижка», «экспресс» или имя мастера")}</p>}
          {q && loading && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Загрузка…")}</p>}
          {q && !loading && !first && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Ничего не найдено")}</p>}
          {group(t("Услуги"), foundServices)}
          {group(t("Мастера"), foundMasters)}
        </div>
      </div>
    </div>
  )
}
