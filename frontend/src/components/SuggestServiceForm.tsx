// components/SuggestServiceForm.tsx
import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { catalogApi } from "@/api/api"
import { toApiError } from "@/api/client"

const EMPTY = { title: "", description: "", name: "", contact: "" }

const inputClass =
  "w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-colors"

export function SuggestServiceForm() {
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update =
    (field: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (form.title.trim().length < 3) {
      setError("Название услуги должно содержать минимум 3 символа.")
      return
    }
    if (!form.contact.trim()) {
      setError("Укажите телефон или email для связи.")
      return
    }

    setSending(true)
    try {
      await catalogApi.suggestService({
        title: form.title.trim(),
        description: form.description.trim(),
        name: form.name.trim(),
        contact: form.contact.trim(),
      })
      setForm(EMPTY)
      setSent(true)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-rose-50 rounded-3xl border border-rose-100 p-8 md:p-12 text-center">
        <CheckCircle2 className="size-10 text-gold mx-auto mb-4" />
        <h2 className="text-2xl font-serif text-foreground mb-2">
          Спасибо за предложение!
        </h2>
        <p className="text-muted-foreground mb-6">
          Мы рассмотрим его и свяжемся с вами, если появятся вопросы.
        </p>
        <button
          onClick={() => setSent(false)}
          className="border-2 border-gold text-gold hover:bg-gold hover:text-white px-6 py-2 rounded-full text-sm font-medium transition-colors"
        >
          Предложить ещё
        </button>
      </div>
    )
  }

  return (
    <section className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 md:p-10">
      <h2 className="text-3xl font-serif text-foreground mb-2 text-center">
        Не нашли нужную услугу?
      </h2>
      <p className="text-muted-foreground text-center max-w-xl mx-auto mb-8">
        Расскажите, какой процедуры вам не хватает. Мы изучим все предложения и
        добавим самые востребованные услуги.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4 max-w-xl mx-auto" noValidate>
        <div>
          <label htmlFor="suggest-title" className="block text-sm font-medium text-foreground mb-1">
            Название услуги *
          </label>
          <input
            id="suggest-title"
            value={form.title}
            onChange={update("title")}
            maxLength={150}
            placeholder="Например, ламинирование ресниц"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="suggest-description" className="block text-sm font-medium text-foreground mb-1">
            Описание
          </label>
          <textarea
            id="suggest-description"
            value={form.description}
            onChange={update("description")}
            maxLength={1000}
            rows={4}
            placeholder="Что именно вы хотели бы получить"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="suggest-name" className="block text-sm font-medium text-foreground mb-1">
              Ваше имя
            </label>
            <input
              id="suggest-name"
              value={form.name}
              onChange={update("name")}
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="suggest-contact" className="block text-sm font-medium text-foreground mb-1">
              Телефон или email *
            </label>
            <input
              id="suggest-contact"
              value={form.contact}
              onChange={update("contact")}
              maxLength={100}
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="bg-gold hover:bg-gold-hover disabled:opacity-60 text-white px-8 py-3 rounded-full font-medium transition-colors mt-2"
        >
          {sending ? "Отправляем…" : "Отправить предложение"}
        </button>
      </form>
    </section>
  )
}