import { useEffect, useState } from "react"
import { X } from "lucide-react"
import type { PublicReview } from "@/api/api"
import { formatDate } from "@/lib/format"
import { Avatar } from "./Avatar"
import { StarRating } from "./StarRating"

/** Фото на весь экран: закрывается кликом или Esc */
export function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Фото к отзыву"
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 cursor-zoom-out"
    >
      <img src={src} alt="Фото к отзыву" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
      <button onClick={onClose} autoFocus aria-label="Закрыть" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20">
        <X className="size-6" />
      </button>
    </div>
  )
}

/** Опубликованный отзыв: автор «Анна С.», оценка, текст, фото и ответ салона */
export function ReviewCard({ review: r, compact = false }: { review: PublicReview; compact?: boolean }) {
  const [opened, setOpened] = useState<string | null>(null)
  return (
    <article className="bg-white rounded-3xl border border-rose-100 p-6 shadow-sm flex flex-col">
      <header className="flex items-center gap-3 mb-3">
        <Avatar src={r.author_avatar} name={r.author} className="size-10 text-sm" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">{r.author}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(r.created_at.slice(0, 10))} · {r.service_name} · мастер {r.employee_name}
          </p>
        </div>
        <StarRating value={r.rating} />
      </header>
      <p className={`text-foreground whitespace-pre-line ${compact ? "line-clamp-4" : ""}`}>{r.text}</p>
      {r.photos.length > 0 && (
        <div className="flex gap-2 mt-4">
          {r.photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpened(p.url)}
              aria-label="Открыть фото"
              className={`${compact ? "size-14" : "size-20"} rounded-xl overflow-hidden border border-rose-100 hover:border-gold transition-colors cursor-zoom-in`}
            >
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {r.reply && !compact && (
        <div className="mt-4 ml-2 pl-4 border-l-2 border-gold/50">
          <p className="text-xs font-medium text-gold-dark mb-1">Ответ салона</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{r.reply}</p>
        </div>
      )}
      {opened && <PhotoLightbox src={opened} onClose={() => setOpened(null)} />}
    </article>
  )
}
