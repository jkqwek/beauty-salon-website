import type { PublicReview } from "@/api/api"
import { formatDate } from "@/lib/format"
import { Avatar } from "./Avatar"
import { StarRating } from "./StarRating"

/** Опубликованный отзыв: автор «Анна С.», оценка, текст и ответ салона */
export function ReviewCard({ review: r, compact = false }: { review: PublicReview; compact?: boolean }) {
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
      {r.reply && !compact && (
        <div className="mt-4 ml-2 pl-4 border-l-2 border-gold/50">
          <p className="text-xs font-medium text-gold-dark mb-1">Ответ салона</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{r.reply}</p>
        </div>
      )}
    </article>
  )
}
