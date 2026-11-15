import { useState, type ReactNode } from "react"
import { Clock } from "lucide-react"
import { formatDuration, formatPrice } from "@/lib/format"
import { t } from "@/lib/i18n"
import {
  calcColoring,
  DENSITIES,
  LENGTHS,
  OPTIONS,
  TECHNIQUES,
  type DensityId,
  type LengthId,
  type OptionId,
  type TechniqueId,
} from "@/lib/coloring"

interface ChoiceProps {
  type: "radio" | "checkbox"
  name: string
  checked: boolean
  title: string
  hint?: string
  disabled?: boolean
  onChange: () => void
}

function Choice({ type, name, checked, title, hint, disabled, onChange }: ChoiceProps) {
  return (
    <label className={`relative block ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={onChange} className="peer sr-only" />
      <span className="block h-full rounded-2xl border-2 border-rose-100 bg-white px-4 py-3 text-sm transition-colors hover:border-gold/40 peer-checked:border-gold peer-checked:bg-gold/5 peer-focus-visible:ring-2 peer-focus-visible:ring-gold/50">
        <span className="block font-medium text-foreground">{title}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function Group({ legend, className, children }: { legend: string; className: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-foreground">{legend}</legend>
      <div className={`grid gap-3 ${className}`}>{children}</div>
    </fieldset>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-nowrap text-foreground">{formatPrice(String(value))}</dd>
    </div>
  )
}

export function ColoringCalculator({ onBook }: { onBook: () => void }) {
  const [technique, setTechnique] = useState<TechniqueId>("onetone")
  const [length, setLength] = useState<LengthId>("medium")
  const [density, setDensity] = useState<DensityId>("normal")
  const [picked, setPicked] = useState<OptionId[]>([])

  const result = calcColoring({ technique, length, density, options: picked })
  const lighteningIncluded = TECHNIQUES[technique].includesLightening
  const toggleOption = (id: OptionId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 md:p-10">
      <h2 className="mb-2 text-center text-3xl font-serif text-foreground md:text-4xl">{t("Калькулятор окрашивания")}</h2>
      <p className="mx-auto mb-10 max-w-xl text-center text-muted-foreground">
        {t("Выберите технику и длину волос — мы покажем примерную стоимость и время работы.")}
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <Group legend={t("Техника окрашивания")} className="sm:grid-cols-2">
            {(Object.keys(TECHNIQUES) as TechniqueId[]).map((id) => (
              <Choice
                key={id}
                type="radio"
                name="coloring-technique"
                checked={technique === id}
                title={t(TECHNIQUES[id].label)}
                hint={t(TECHNIQUES[id].hint)}
                onChange={() => setTechnique(id)}
              />
            ))}
          </Group>

          <Group legend={t("Длина волос")} className="grid-cols-2 xl:grid-cols-4">
            {(Object.keys(LENGTHS) as LengthId[]).map((id) => (
              <Choice
                key={id}
                type="radio"
                name="coloring-length"
                checked={length === id}
                title={t(LENGTHS[id].label)}
                hint={t(LENGTHS[id].hint)}
                onChange={() => setLength(id)}
              />
            ))}
          </Group>

          <Group legend={t("Густота волос")} className="grid-cols-3">
            {(Object.keys(DENSITIES) as DensityId[]).map((id) => (
              <Choice
                key={id}
                type="radio"
                name="coloring-density"
                checked={density === id}
                title={t(DENSITIES[id].label)}
                onChange={() => setDensity(id)}
              />
            ))}
          </Group>

          <Group legend={t("Дополнительно")} className="sm:grid-cols-2">
            {(Object.keys(OPTIONS) as OptionId[]).map((id) => {
              const included = id === "lightening" && lighteningIncluded
              return (
                <Choice
                  key={id}
                  type="checkbox"
                  name={`coloring-option-${id}`}
                  checked={included ? false : picked.includes(id)}
                  disabled={included}
                  title={t(OPTIONS[id].label)}
                  hint={included ? t("Уже входит в выбранную технику") : undefined}
                  onChange={() => toggleOption(id)}
                />
              )
            })}
          </Group>
        </div>

        <aside className="self-start rounded-3xl border border-gold/40 bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <h3 className="mb-4 text-xl font-serif text-foreground">{t("Ориентировочная стоимость")}</h3>

          <dl className="space-y-2 text-sm">
            <Row label={t("Работа мастера")} value={result.work} />
            <Row label={t("Краска, около {grams} г", { grams: result.dyeGrams })} value={result.dye} />
            {result.options.map((o) => (
              <Row key={o.id} label={t(o.label)} value={o.price} />
            ))}
          </dl>

          <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-rose-100 pt-4">
            <span className="font-medium text-foreground">{t("Итого")}</span>
            <span aria-live="polite" className="text-3xl font-serif text-gold-dark">
              {formatPrice(String(result.total))}
            </span>
          </div>

          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {t("Время работы: около {time}", { time: formatDuration(result.minutes) })}
          </p>

          <p className="mt-4 text-xs text-muted-foreground">
            {t("Расчёт ориентировочный: точную стоимость определит мастер после осмотра волос.")}
          </p>

          <button
            onClick={onBook}
            className="mt-6 w-full rounded-full bg-gold px-6 py-3 font-medium text-white shadow-sm transition-colors hover:bg-gold-hover"
          >
            {t("Записаться")}
          </button>
        </aside>
      </div>
    </section>
  )
}