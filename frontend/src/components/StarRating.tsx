import { t } from "@/lib/i18n"
import { Star } from "lucide-react"

/** Оценка звёздами. С onChange — выбор оценки (радиокнопки для клавиатуры и скринридеров) */
export function StarRating({ value, onChange, size = "size-4" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  const star = (n: number) => <Star className={`${size} ${n <= value ? "fill-gold text-gold" : "text-rose-200"}`} />

  if (!onChange) {
    return (
      <span role="img" aria-label={t("Оценка {n} из 5", { n: value })} className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{star(n)}</span>
        ))}
      </span>
    )
  }
  return (
    <div role="radiogroup" aria-label={t("Оценка")} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={t("{n} из 5", { n })}
          onClick={() => onChange(n)}
          className="p-1 rounded-full hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {star(n)}
        </button>
      ))}
    </div>
  )
}
