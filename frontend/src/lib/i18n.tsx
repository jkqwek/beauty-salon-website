import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react"
import { EN } from "./en"

export type Lang = "ru" | "en"
const STORAGE_KEY = "allure-lang"

function readLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ru"
  } catch {
    return "ru" // localStorage может быть недоступен (приватный режим)
  }
}

let current: Lang = readLang()

export const getLang = () => current

/** Локаль для дат и чисел */
export const locale = () => (current === "en" ? "en-GB" : "ru-RU")

/**
 * Перевод по русской фразе: t("Записаться") -> "Book now" в английской версии.
 * Значения подставляются в {имя}: t("Запись {day}", { day: "завтра" }).
 * Нет перевода в src/lib/en.ts — остаётся русский текст.
 */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = current === "en" ? (EN[text] ?? text) : text
  if (vars) for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value))
  return out
}

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: "ru", setLang: () => {} })

export const useLang = () => useContext(LangContext)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (next: Lang) => {
    current = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* не сохранилось — язык останется до перезагрузки */
    }
    setLangState(next)
  }

  // key заставляет перерисовать всё приложение: t() читает язык в момент отрисовки
  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <Fragment key={lang}>{children}</Fragment>
    </LangContext.Provider>
  )
}
