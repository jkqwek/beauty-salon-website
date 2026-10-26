import { useEffect, useState, type ChangeEvent, type ReactNode } from "react"
import { ImagePlus, X } from "lucide-react"
import { bookingApi, type Booking } from "@/api/api"
import { toApiError, type ApiError } from "@/api/client"
import { useApi } from "@/api/useApi"
import { formatDate, formatTime } from "@/lib/format"
import { BookingCalendar, SlotPicker } from "./BookingCalendar"
import { ErrorMessage } from "./ErrorMessage"
import { PriceTag } from "./PriceTag"
import { StarRating } from "./StarRating"

export function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-rose-50 w-full max-w-lg max-h-[90vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-serif text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">{children}</div>
      </div>
    </div>
  )
}

const primaryBtn =
  "w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"

/** Перенос своей записи: те же мастер и услуга, новая дата и время. Цена — по новой дате */
export function RescheduleModal({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (updated: Booking) => void }) {
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const slots = useApi(() => (date ? bookingApi.slots({ bookingId: booking.id, date }) : Promise.resolve(null)), [date])
  const quote = useApi(() => (date ? bookingApi.price(booking.service, date) : Promise.resolve(null)), [date])

  const submit = async () => {
    if (!date || !time) return
    setSaving(true)
    setError(null)
    try {
      onDone(await bookingApi.reschedule(booking.id, date, time))
    } catch (e) {
      setError(toApiError(e))
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Перенос записи" onClose={onClose}>
      <p className="text-muted-foreground">
        {booking.service_name} · {booking.employee_name}
        <br />
        Сейчас: {formatDate(booking.date)}, {formatTime(booking.start_time)}
      </p>

      <BookingCalendar
        bookingId={booking.id}
        value={date}
        onChange={(iso) => {
          setDate(iso)
          setTime(null)
          setError(null)
        }}
      />

      {date && (
        <div>
          <h3 className="font-medium text-foreground mb-3">Свободное время</h3>
          {slots.loading && <p className="text-muted-foreground">Загрузка…</p>}
          {slots.error && <ErrorMessage error={slots.error} onRetry={slots.reload} />}
          {slots.data && slots.data.slots.length === 0 && (
            <p className="text-sm text-muted-foreground">На эту дату свободного времени нет — выберите другой день.</p>
          )}
          {slots.data && <SlotPicker slots={slots.data.slots} value={time} onChange={setTime} />}
        </div>
      )}

      {date && time && (
        <div className="bg-white rounded-2xl border border-rose-100 p-4 space-y-2 text-sm">
          <p className="flex justify-between gap-4">
            <span className="text-muted-foreground">Новое время</span>
            <span className="font-medium">{formatDate(date)}, {time}</span>
          </p>
          {quote.data && (
            <p className="flex justify-between gap-4">
              <span className="text-muted-foreground">Цена</span>
              <PriceTag base={quote.data.base_price} price={quote.data.price} discount={quote.data.discount_percent} className="font-medium" />
            </p>
          )}
          <p className="text-xs text-yellow-800">После переноса запись снова будет ждать подтверждения салона.</p>
        </div>
      )}

      {error && <ErrorMessage error={error} />}
      <button onClick={submit} disabled={!date || !time || saving} className={primaryBtn}>
        {saving ? "Переносим…" : "Перенести"}
      </button>
    </ModalShell>
  )
}

const MAX_PHOTOS = 3
const MAX_PHOTO_SIZE = 10 * 1024 * 1024

/** Отзыв о выполненном визите: оценка (если уже есть из бота — подставлена), текст и до 3 фото */
export function ReviewModal({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(booking.rating ?? 0)
  const [text, setText] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | string | null>(null)
  const length = text.trim().length

  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = photos.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [photos])

  const addPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // чтобы тот же файл можно было выбрать снова
    const wrong = files.find((f) => !["image/jpeg", "image/png"].includes(f.type) || f.size > MAX_PHOTO_SIZE)
    if (wrong) return setError(`«${wrong.name}»: подходят только JPG и PNG до 10 МБ.`)
    if (photos.length + files.length > MAX_PHOTOS) setError(`Можно приложить не больше ${MAX_PHOTOS} фото.`)
    else setError(null)
    setPhotos([...photos, ...files].slice(0, MAX_PHOTOS))
  }

  const submit = async () => {
    if (!rating) return setError("Поставьте оценку от 1 до 5.")
    if (length < 10) return setError("Напишите хотя бы пару слов — от 10 символов.")
    setSaving(true)
    setError(null)
    try {
      await bookingApi.review(booking.id, { rating, text: text.trim(), photos })
      onDone()
    } catch (e) {
      setError(toApiError(e))
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Отзыв о визите" onClose={onClose}>
      <p className="text-muted-foreground">
        {booking.service_name} · {booking.employee_name} · {formatDate(booking.date)}
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Оценка</p>
        <StarRating value={rating} onChange={setRating} size="size-7" />
      </div>
      <div className="space-y-2">
        <label htmlFor="review-text" className="text-sm font-medium text-foreground">
          Ваш отзыв
        </label>
        <textarea
          id="review-text"
          rows={5}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что понравилось, что можно улучшить"
          className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
        />
        <p className="text-xs text-muted-foreground text-right">{length} / 1000</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Фото (необязательно)</p>
        <div className="flex flex-wrap gap-3">
          {previews.map((url, i) => (
            <div key={url} className="relative size-20">
              <img src={url} alt={`Фото ${i + 1}`} className="size-full object-cover rounded-xl border border-rose-100" />
              <button
                type="button"
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                aria-label={`Убрать фото ${i + 1}`}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-white border border-rose-200 text-muted-foreground hover:text-rose-600 shadow-sm"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="size-20 rounded-xl border-2 border-dashed border-rose-200 hover:border-gold text-muted-foreground hover:text-gold flex flex-col items-center justify-center gap-1 text-xs cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-gold">
              <ImagePlus className="size-5" />
              Добавить
              <input type="file" accept="image/jpeg,image/png" multiple onChange={addPhotos} className="sr-only" />
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground">До {MAX_PHOTOS} фото, JPG или PNG до 10 МБ.</p>
      </div>
      <p className="text-xs text-muted-foreground">Отзыв и фото появятся на сайте после проверки. Изменить их потом нельзя.</p>
      {error && <ErrorMessage error={error} />}
      <button onClick={submit} disabled={saving} className={primaryBtn}>
        {saving ? "Отправляем…" : "Отправить отзыв"}
      </button>
    </ModalShell>
  )
}
