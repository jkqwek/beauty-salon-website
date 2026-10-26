import { SERVICE_TAGS, type ServiceTag } from "@/api/api"
import { t } from "@/lib/i18n"

export const tagName = (tag: ServiceTag) => t(SERVICE_TAGS[tag] ?? tag)

/** Теги услуги золотистыми метками. С onPick метка — кнопка (на «Услугах» включает фильтр) */
export function TagChips({ tags, active, onPick }: { tags: ServiceTag[]; active?: ServiceTag | null; onPick?: (tag: ServiceTag) => void }) {
  const ordered = (Object.keys(SERVICE_TAGS) as ServiceTag[]).filter((tag) => tags.includes(tag)) // всегда в порядке списка
  if (!ordered.length) return null
  const cls = (tag: ServiceTag) =>
    `px-2.5 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors ${
      active === tag ? "bg-gold text-white border-gold" : "bg-gold/10 text-gold-dark border-gold/30"
    }`
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((tag) =>
        onPick ? (
          <button key={tag} onClick={() => onPick(tag)} aria-pressed={active === tag} className={`${cls(tag)} hover:border-gold`}>
            {tagName(tag)}
          </button>
        ) : (
          <span key={tag} className={cls(tag)}>
            {tagName(tag)}
          </span>
        ),
      )}
    </div>
  )
}
