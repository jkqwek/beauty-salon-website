import { NavLink, useLocation } from "react-router"
import { Scale, X } from "lucide-react"
import { useCompare } from "@/lib/compare"
import { t } from "@/lib/i18n"

/** Плашка внизу экрана, пока выбраны услуги для сравнения (на самой странице сравнения не нужна) */
export function CompareBar() {
  const { ids, clear } = useCompare()
  const { pathname } = useLocation()
  if (!ids.length || pathname === "/compare") return null
  return (
    <div className="fixed bottom-6 left-4 right-24 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 bg-white border border-gold/40 shadow-xl rounded-full pl-5 pr-2 py-2 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground whitespace-nowrap">
        <Scale className="size-5 text-gold hidden sm:block" />
        {t("Сравнение: {n}", { n: ids.length })}
      </span>
      <span className="flex items-center gap-1">
        <button onClick={clear} title={t("Очистить сравнение")} aria-label={t("Очистить сравнение")} className="p-2 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
        <NavLink
          to={`/compare?ids=${ids.join(",")}`}
          className="bg-gold hover:bg-gold-hover text-white rounded-full px-5 py-2 text-sm font-medium transition-colors whitespace-nowrap"
        >
          {t("Сравнить")}
        </NavLink>
      </span>
    </div>
  )
}
