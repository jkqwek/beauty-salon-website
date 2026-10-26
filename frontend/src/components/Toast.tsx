import { useEffect, useState } from "react"
import { NavLink } from "react-router"
import { CheckCircle2, X } from "lucide-react"
import { t } from "@/lib/i18n"

const TOAST_EVENT = "app:toast"
const LIFETIME = 5000

interface ToastItem {
  id: number
  text: string
  link?: { to: string; label: string }
}

let lastId = 0

/** Всплывающее уведомление: можно вызвать из любого места, покажет <Toaster /> в шапке сайта */
export const toast = (text: string, link?: ToastItem["link"]) =>
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: { id: ++lastId, text, link } }))

/** Стопка уведомлений справа сверху (на телефоне — на всю ширину); каждое живёт 5 секунд */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  const close = (id: number) => setItems((list) => list.filter((item) => item.id !== id))

  useEffect(() => {
    const onToast = (e: Event) => {
      const item = (e as CustomEvent<ToastItem>).detail
      setItems((list) => [...list, item])
      setTimeout(() => close(item.id), LIFETIME)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  return (
    <div aria-live="polite" className="fixed top-24 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-[120] flex flex-col gap-3 pointer-events-none">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className="pointer-events-auto bg-white border border-gold/40 shadow-lg rounded-2xl p-4 flex items-start gap-3"
        >
          <CheckCircle2 className="size-5 text-gold shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-foreground">
            {item.text}
            {item.link && (
              <NavLink to={item.link.to} onClick={() => close(item.id)} className="block mt-1 font-medium text-gold-dark hover:underline">
                {item.link.label}
              </NavLink>
            )}
          </div>
          <button onClick={() => close(item.id)} aria-label={t("Закрыть уведомление")} className="p-1 -m-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
