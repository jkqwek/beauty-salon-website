import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { bookingApi } from "@/api/api"
import { useApi } from "@/api/useApi"
import { formatDayMonth, shiftDate, toIsoDate } from "@/lib/format"
import { ErrorMessage } from "./ErrorMessage"

const MAX_DAYS_AHEAD = 90 // как MAX_DAYS_AHEAD в backend/bookings/services.py
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

interface Props {
  serviceId?: number
  employeeId?: number | null // не задан — любой мастер, оказывающий услугу
  bookingId?: number // перенос своей записи: мастер и услуга берутся из неё
  value: string | null
  onChange: (iso: string) => void
}

/** Подряд идущие дни с одной подписью -> «5–6 октября — Санитарный день» */
function holidayList(holidays: Record<string, string>) {
  const ranges: { from: string; to: string; label: string }[] = []
  for (const [day, label] of Object.entries(holidays).sort()) {
    const last = ranges[ranges.length - 1]
    if (last && last.label === label && shiftDate(last.to, 1) === day) last.to = day
    else ranges.push({ from: day, to: day, label })
  }
  return ranges.map((r) => ({
    ...r,
    when: r.from === r.to ? formatDayMonth(r.from) : `${formatDayMonth(r.from)} – ${formatDayMonth(r.to)}`,
  }))
}

/** Календарь записи: заранее видно, в какие дни есть свободное время, праздники подписаны */
export function BookingCalendar({ serviceId, employeeId, bookingId, value, onChange }: Props) {
  const today = toIsoDate(new Date())
  const lastDay = shiftDate(today, MAX_DAYS_AHEAD)
  const [month, setMonth] = useState(() => (value ?? today).slice(0, 7)) // "2026-10"
  const days = useApi(
    () => bookingApi.availableDays({ serviceId, employeeId, bookingId, month }),
    [serviceId, employeeId, bookingId, month],
  )

  const [y, m] = month.split("-").map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // неделя с понедельника
  const shiftMonth = (n: number) => setMonth(toIsoDate(new Date(y, m - 1 + n, 1)).slice(0, 7))
  const available = new Set(days.data?.available)
  const holidays = days.data?.holidays ?? {}

  return (
    <div className="bg-white rounded-2xl p-6 border border-rose-100">
      <div className="flex items-center justify-between mb-4">
        <span className="font-medium text-foreground capitalize">
          {new Date(y, m - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
        </span>
        <div className="flex gap-2">
          <button
            disabled={month <= today.slice(0, 7)}
            onClick={() => shiftMonth(-1)}
            aria-label="Предыдущий месяц"
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            disabled={`${month}-31` >= lastDay}
            onClick={() => shiftMonth(1)}
            aria-label="Следующий месяц"
            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-7 gap-1 text-center mb-2 transition-opacity ${days.loading ? "opacity-50" : ""}`}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-xs font-medium text-muted-foreground py-2">
            {d}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = `${month}-${String(i + 1).padStart(2, "0")}`
          const holiday = holidays[iso]
          const free = available.has(iso)
          const hint = holiday ?? (iso >= today && iso <= lastDay && !free && days.data ? "Нет свободного времени" : undefined)
          return (
            <button
              key={iso}
              disabled={!free || days.loading}
              onClick={() => onChange(iso)}
              title={hint}
              aria-label={`${formatDayMonth(iso)}${hint ? `: ${hint}` : ""}`}
              aria-pressed={iso === value}
              className={`relative aspect-square rounded-full flex items-center justify-center text-sm ${
                iso === value
                  ? "bg-gold text-white font-medium"
                  : free
                    ? "hover:bg-rose-50 text-foreground"
                    : holiday
                      ? "bg-rose-50 text-rose-300 cursor-not-allowed"
                      : "text-muted-foreground/40 cursor-not-allowed"
              }`}
            >
              {i + 1}
              {holiday && <span className="absolute bottom-1 size-1 rounded-full bg-rose-400" aria-hidden />}
            </button>
          )
        })}
      </div>

      {days.error && <ErrorMessage error={days.error} onRetry={days.reload} />}
      {days.data && holidayList(holidays).length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-rose-700">
          {holidayList(holidays).map((h) => (
            <li key={h.from} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-rose-400 shrink-0" aria-hidden /> {h.when} — {h.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Свободное время выбранного дня */
export function SlotPicker({ slots, value, onChange }: { slots: string[]; value: string | null; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {slots.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          aria-pressed={t === value}
          className={`px-5 py-2.5 rounded-full text-sm font-medium border transition-colors ${
            t === value ? "bg-gold border-gold text-white" : "bg-white border-gold text-gold hover:bg-gold/10"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
