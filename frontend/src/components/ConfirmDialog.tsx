import { useEffect, useState, type ReactNode } from "react"
import { t } from "@/lib/i18n"

interface ConfirmDialogProps {
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean // красная кнопка для необратимых действий (отмена записи)
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

/** Подтверждение действия в стиле сайта вместо системного confirm(). Esc — закрыть */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-8 text-center space-y-4"
      >
        <h2 id="confirm-title" className="text-2xl font-serif text-foreground">
          {title}
        </h2>
        {children && <div className="text-muted-foreground">{children}</div>}
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button
            onClick={onClose}
            autoFocus
            className="px-6 py-3 rounded-full border border-rose-200 text-foreground font-medium hover:bg-rose-50 transition-colors whitespace-nowrap"
          >
            {cancelLabel ?? t("Отмена")}
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className={`px-6 py-3 rounded-full text-white font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-gold hover:bg-gold-hover"
            }`}
          >
            {busy ? t("Подождите…") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
