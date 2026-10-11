import { useState } from "react"

/** Круглый аватар: фото, а если его нет (или не загрузилось) — инициалы на розовом фоне */
export function Avatar({ src, name, className = "size-10 text-sm" }: { src?: string | null; name: string; className?: string }) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()

  if (src && src !== brokenSrc) {
    return (
      <img src={src} alt={name} onError={() => setBrokenSrc(src)} className={`${className} rounded-full object-cover shrink-0`} />
    )
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`${className} rounded-full bg-rose-100 text-rose-700 font-medium flex items-center justify-center shrink-0 select-none`}
    >
      {initials || "?"}
    </span>
  )
}
