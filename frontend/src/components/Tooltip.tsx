import type { ReactNode } from "react"
import { Info } from "lucide-react"

/** Компактная подсказка, доступная при наведении и клавиатурном фокусе. */
export function Tooltip({ content }: { content: string }) {
  return (
    <span className="help-tooltip" tabIndex={0} aria-label={content} data-tooltip={content}>
      <Info className="size-4 text-gold-dark" aria-hidden="true" />
    </span>
  )
}
