import { useState } from "react"
import { supportApi } from "@/api/api"
import { toApiError } from "@/api/client"
import { ErrorMessage } from "./ErrorMessage"
import { X } from "lucide-react"
import { INPUT } from "./CrudTable"

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("")
  const [contact, setContact] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim().length < 10) {
      return setError("Пожалуйста, опишите проблему подробнее (минимум 10 символов).")
    }

    setSaving(true)
    setError(null)
    try {
      await supportApi.sendBugReport({ text, contact })
      setSuccess(true)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b border-rose-100 flex items-center justify-between">
          <h2 className="text-2xl font-serif text-foreground">Сообщить об ошибке</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground bg-rose-50 rounded-full transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center space-y-4 py-8">
              <div className="size-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-foreground">Спасибо!</h3>
              <p className="text-muted-foreground">Мы получили ваше сообщение и скоро всё исправим.</p>
              <button onClick={onClose} className="mt-6 px-8 py-3 bg-gold text-white rounded-full font-medium hover:bg-gold-hover transition-colors">
                Закрыть
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Что-то сломалось или работает неправильно? Расскажите нам, и мы починим.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Описание проблемы</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  placeholder="Опишите, что произошло..."
                  className={INPUT}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Контакт для связи (необязательно)</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Email или телефон"
                  className={INPUT}
                />
              </div>

              {error && <ErrorMessage error={error} />}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors disabled:opacity-50 mt-2"
              >
                {saving ? "Отправка…" : "Отправить"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}