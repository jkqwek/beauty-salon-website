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