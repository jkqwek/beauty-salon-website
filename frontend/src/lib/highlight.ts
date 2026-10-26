import { useEffect, useState } from "react"
import { useLocation, useSearchParams } from "react-router"

/** Переход из поиска (?service=5, ?master=3): прокрутить к карточке с id "service-5" и подсветить её.
 *  isShown(id) — карточка уже на странице (данные загружены, фильтр её не скрывает) */
export function useHighlight(param: string, isShown: (id: number) => boolean) {
  const [params] = useSearchParams()
  const { key } = useLocation() // повторный переход на тот же результат тоже подсвечивает
  const target = Number(params.get(param)) || null
  const ready = target !== null && isShown(target)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (!target || !ready) return
    document.getElementById(`${param}-${target}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    setActive(target)
    const timer = setTimeout(() => setActive(null), 2500)
    return () => clearTimeout(timer)
  }, [target, ready, key])

  return { target, active }
}
