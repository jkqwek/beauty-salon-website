import type { Employee } from "@/api/api"
import photoRostova from "@/imports/Rostova.png"
import photoLin from "@/imports/lin.png"
import photoKravtsova from "@/imports/kravchova.png"
import photoTarasov from "@/imports/tarasov.png"
import photoVishnevskaya from "@/imports/vishnevskaya.png"
import photoKim from "@/imports/kim.png"

const LOCAL_PHOTOS: Record<string, string> = {
  "Елена Ростова": photoRostova,
  "София Лин": photoLin,
  "Злата Кравцова": photoKravtsova,
  "Богдан Тарасов": photoTarasov,
  "Дарина Вишневская": photoVishnevskaya,
  "Дэвид Ким": photoKim,
}

export const masterPhoto = (e: Employee): string | null =>
  e.photo ?? LOCAL_PHOTOS[e.full_name] ?? null