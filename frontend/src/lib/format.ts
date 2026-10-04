export const formatPrice = (price: string) =>
  `${Number(price).toLocaleString("ru-RU")} ₽`

export const formatDuration = (minutes: number) => `${minutes} мин`

/** "2026-10-24" -> "24 октября 2026" */
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** "10:00:00" -> "10:00" */
export const formatTime = (time: string) => time.slice(0, 5)

/** Date -> "2026-10-24" в местном времени */
export const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/** "2026-10-24" + n дней */
export const shiftDate = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number)
  return toIsoDate(new Date(y, m - 1, d + days))
}
