import { NavLink } from "react-router"
import { ChevronRight } from "lucide-react"
import { t } from "@/lib/i18n"

export interface Crumb {
  label: string
  to?: string // нет — текущая страница, не ссылка
  onClick?: () => void // например, сбросить фильтры при переходе на «Услуги»
}

/** Хлебные крошки над заголовком страницы; разметка schema.org — для поисковиков */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label={t("Навигационная цепочка")} className="mb-4">
      <ol itemScope itemType="https://schema.org/BreadcrumbList" className="flex flex-wrap items-center justify-center gap-1.5 text-sm">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={i} itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" className="flex items-center gap-1.5">
              {item.to && !last ? (
                <NavLink to={item.to} onClick={item.onClick} itemProp="item" className="text-gold-dark hover:underline">
                  <span itemProp="name">{item.label}</span>
                </NavLink>
              ) : (
                <span itemProp="name" aria-current={last ? "page" : undefined} className="text-muted-foreground">
                  {item.label}
                </span>
              )}
              <meta itemProp="position" content={String(i + 1)} />
              {!last && <ChevronRight className="size-3.5 text-muted-foreground/60" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
