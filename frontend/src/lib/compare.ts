import { useSyncExternalStore } from "react"

/** Услуги, выбранные для сравнения: общие для карточек, плашки внизу и страницы /compare.
 *  Хранятся в браузере, чтобы не пропасть после перезагрузки */
export const MAX_COMPARE = 4
const STORAGE_KEY = "allure-compare"
const listeners = new Set<() => void>()

function load(): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    return Array.isArray(saved) ? saved.filter(Number.isInteger).slice(0, MAX_COMPARE) : []
  } catch {
    return [] // localStorage недоступен — сравнение живёт до перезагрузки
  }
}

let current = load()

function set(ids: number[]) {
  current = [...new Set(ids)].slice(0, MAX_COMPARE)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    /* не сохранилось — ничего страшного */
  }
  listeners.forEach((notify) => notify())
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, () => current)
  return {
    ids,
    has: (id: number) => ids.includes(id),
    /** false — уже выбрано максимум услуг */
    toggle: (id: number) => {
      if (current.includes(id)) set(current.filter((x) => x !== id))
      else if (current.length >= MAX_COMPARE) return false
      else set([...current, id])
      return true
    },
    remove: (id: number) => set(current.filter((x) => x !== id)),
    replace: set,
    clear: () => set([]),
  }
}
