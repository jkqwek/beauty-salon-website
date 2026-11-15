export type TechniqueId = "roots" | "onetone" | "highlights" | "balayage" | "airtouch"
export type LengthId = "short" | "medium" | "long" | "xlong"
export type DensityId = "thin" | "normal" | "thick"
export type OptionId = "lightening" | "toning" | "care" | "styling"

export const DYE_PRICE_PER_GRAM = 15 // за грамм краски

export const TECHNIQUES: Record<
  TechniqueId,
  { label: string; hint: string; price: number; minutes: number; dyeFactor: number; includesLightening: boolean }
> = {
  roots: { label: "Окрашивание корней", hint: "Отросшие корни", price: 3000, minutes: 90, dyeFactor: 0.5, includesLightening: false },
  onetone: { label: "Один тон", hint: "Равномерный цвет по всей длине", price: 4500, minutes: 120, dyeFactor: 1, includesLightening: false },
  highlights: { label: "Мелирование", hint: "Осветлённые пряди", price: 6000, minutes: 180, dyeFactor: 0.8, includesLightening: true },
  balayage: { label: "Балаяж / омбре", hint: "Плавный переход цвета", price: 8000, minutes: 240, dyeFactor: 1.1, includesLightening: true },
  airtouch: { label: "Airtouch", hint: "Сложное окрашивание с эффектом выгорания", price: 10000, minutes: 270, dyeFactor: 1.2, includesLightening: true },
}

export const LENGTHS: Record<LengthId, { label: string; hint: string; coef: number; dyeGrams: number }> = {
  short: { label: "Короткие", hint: "до подбородка", coef: 1, dyeGrams: 40 },
  medium: { label: "Средние", hint: "до плеч", coef: 1.25, dyeGrams: 60 },
  long: { label: "Длинные", hint: "до лопаток", coef: 1.5, dyeGrams: 90 },
  xlong: { label: "Очень длинные", hint: "ниже лопаток", coef: 1.8, dyeGrams: 120 },
}

export const DENSITIES: Record<DensityId, { label: string; factor: number }> = {
  thin: { label: "Редкие", factor: 0.9 },
  normal: { label: "Средние", factor: 1 },
  thick: { label: "Густые", factor: 1.15 },
}

export const OPTIONS: Record<OptionId, { label: string; price: number; minutes: number; byLength: boolean }> = {
  lightening: { label: "Предварительное осветление", price: 2000, minutes: 60, byLength: true },
  toning: { label: "Тонирование", price: 1500, minutes: 30, byLength: false },
  care: { label: "Восстанавливающий уход", price: 1500, minutes: 30, byLength: false },
  styling: { label: "Укладка", price: 2000, minutes: 30, byLength: false },
}

export interface ColoringParams {
  technique: TechniqueId
  length: LengthId
  density: DensityId
  options: OptionId[]
}

export interface ColoringResult {
  work: number
  dye: number
  dyeGrams: number
  options: { id: OptionId; label: string; price: number }[]
  total: number
  minutes: number
}

export function calcColoring({ technique, length, density, options }: ColoringParams): ColoringResult {
  const tech = TECHNIQUES[technique]
  const len = LENGTHS[length]

  const work = Math.round(tech.price * len.coef)
  const dyeGrams = Math.round((len.dyeGrams * tech.dyeFactor * DENSITIES[density].factor) / 5) * 5
  const dye = dyeGrams * DYE_PRICE_PER_GRAM

  const chosen = options
    .filter((id) => !(id === "lightening" && tech.includesLightening))
    .map((id) => {
      const o = OPTIONS[id]
      return { id, label: o.label, price: o.byLength ? Math.round(o.price * len.coef) : o.price, minutes: o.minutes }
    })

  return {
    work,
    dye,
    dyeGrams,
    options: chosen.map(({ id, label, price }) => ({ id, label, price })),
    total: work + dye + chosen.reduce((sum, o) => sum + o.price, 0),
    minutes: Math.round(tech.minutes * len.coef) + chosen.reduce((sum, o) => sum + o.minutes, 0),
  }
}