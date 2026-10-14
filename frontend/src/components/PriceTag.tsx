import { formatPrice } from "@/lib/format"

/** Цена со скидкой: старая зачёркнута, новая и метка «−20%». Без скидки — просто цена */
export function PriceTag({ base, price, discount, className = "" }: { base: string; price: string; discount: number; className?: string }) {
  if (!discount) return <span className={className}>{formatPrice(base)}</span>
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <s className="text-sm font-normal text-muted-foreground">{formatPrice(base)}</s>
      <span>{formatPrice(price)}</span>
      <span className="self-center px-2 py-0.5 rounded-full bg-rose-600 text-white text-xs font-semibold">−{discount}%</span>
    </span>
  )
}
