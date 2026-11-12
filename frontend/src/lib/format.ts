import { getLang, locale, t } from "./i18n"
export const formatPrice = (price: string) =>
  `${Number(price).toLocaleString(locale())} ₽`

export const formatDuration = (minutes: number) => t("{n} мин", { n: minutes })

/** "2026-10-24" -> Date в местном времени (без сдвига часового пояса) */
const parseDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** "2026-10-24" -> "24 октября 2026" */
export const formatDate = (iso: string) =>
  parseDate(iso).toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

/** "2026-10-24" -> "24 октября" */
export const formatDayMonth = (iso: string) =>
  parseDate(iso).toLocaleDateString(locale(), { day: "numeric", month: "long" })

/** "2026-10-24" -> "суббота, 24 октября" — заголовок дня в списке */
export const formatDayHeader = (iso: string) =>
  parseDate(iso).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" })

/** Маска телефона при вводе: "89001234567", "+7 900…", "900…" -> "+7 (900) 123-45-67".
 *  Разделители добавляются только перед следующей цифрой, поэтому Backspace не застревает на ")" и "-".
 *  ponytail: курсор после правки в середине номера прыгает в конец — для короткого номера терпимо */
export function maskPhone(value: string): string {
  let d = value.replace(/\D/g, "")
  if (value.startsWith("+7")) d = d.slice(1) // уже в нашем формате
  else if (/^[78]/.test(d)) d = d.slice(1) // начали с 8 или 7
  d = d.slice(0, 10)
  if (!d) return ""
  let out = `+7 (${d.slice(0, 3)}`
  if (d.length > 3) out += `) ${d.slice(3, 6)}`
  if (d.length > 6) out += `-${d.slice(6, 8)}`
  if (d.length > 8) out += `-${d.slice(8, 10)}`
  return out
}

/** "10:00:00" -> "10:00" */
export const formatTime = (time: string) => time.slice(0, 5)

/** Date -> "2026-10-24" в местном времени */
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** "2026-10-24" + n дней */
export const shiftDate = (iso: string, days: number) => {
  const d = parseDate(iso)
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days))
}

/** "сегодня", "завтра" или "24 октября" */
export function relativeDay(iso: string): string {
  const today = toIsoDate(new Date())
  if (iso === today) return t("сегодня")
  if (iso === shiftDate(today, 1)) return t("завтра")
  return formatDayMonth(iso)
}

/** Сколько часов до визита (дата и время в местном времени салона) */
export const hoursUntil = (date: string, time: string) =>
  (new Date(`${date}T${time}`).getTime() - Date.now()) / 3_600_000

/** Календарные периоды: день, неделя пн–вс, месяц с 1-го по последнее число */
export type PeriodMode = "day" | "week" | "month"

export function periodRange(mode: PeriodMode, anchor: string): [string, string] {
  const d = parseDate(anchor)
  if (mode === "day") return [anchor, anchor]
  if (mode === "week") {
    const monday = shiftDate(anchor, -((d.getDay() + 6) % 7))
    return [monday, shiftDate(monday, 6)]
  }
  return [toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1)), toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))]
}

/** Следующий / предыдущий период того же вида */
export function shiftPeriod(mode: PeriodMode, anchor: string, dir: 1 | -1): string {
  if (mode !== "month") return shiftDate(anchor, mode === "week" ? 7 * dir : dir)
  const d = parseDate(anchor)
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + dir, 1))
}

export function periodLabel(mode: PeriodMode, [from, to]: [string, string]): string {
  if (mode === "day") return formatDate(from)
  if (mode === "month") return parseDate(from).toLocaleDateString(locale(), { month: "long", year: "numeric" })
  return `${parseDate(from).toLocaleDateString(locale(), { day: "numeric", month: "long" })} – ${formatDate(to)}`
}

/** 1 отзыв, 2 отзыва, 5 отзывов */
export const plural = (n: number, [one, few, many]: [string, string, string]) => {
  if (getLang() === "en") return `${n} ${t(n === 1 ? one : many)}` // в английском две формы
  const mod10 = n % 10
  const mod100 = n % 100
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many
  return `${n} ${word}`
}
