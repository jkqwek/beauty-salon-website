import { t } from "./i18n"
// Клиентская проверка — только подсказка пользователю. Настоящая проверка на сервере.

export type FieldErrors = Record<string, string>

export const validators = {
  username(value: string): string | null {
    const v = value.trim()
    if (!v) return t("Введите имя пользователя")
    if (v.length < 3) return t("Не короче 3 символов")
    if (v.length > 150) return t("Не длиннее 150 символов")
    if (!/^[\p{L}\p{N}_.@+-]+$/u.test(v)) return t("Только буквы, цифры и символы @ . + - _")
    return null
  },

  email(value: string): string | null {
    const v = value.trim()
    if (!v) return t("Введите email")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t("Введите корректный email")
    return null
  },

  /** Российский номер: 8 900 123-45-67, +7 (900) 123 45 67, 9001234567. Пустой — можно */
  phone(value: string): string | null {
    const v = value.trim()
    if (!v) return null
    const digits = v.replace(/\D/g, "")
    const ok = /^\+?[\d\s()-]+$/.test(v) && (digits.length === 10 || (digits.length === 11 && /^[78]/.test(digits)))
    return ok ? null : t("Введите номер в формате +7 900 123‑45‑67") // неразрывно, чтобы номер не переносился
  },

  password(value: string): string | null {
    if (!value) return t("Введите пароль")
    if (value.length < 8) return t("Не короче 8 символов")
    if (/^\d+$/.test(value)) return t("Пароль не может состоять только из цифр")
    return null
  },

  passwordRepeat(value: string, original: string): string | null {
    return value === original ? null : t("Пароли не совпадают")
  },
}

export function collectErrors(checks: Record<string, string | null>): FieldErrors {
  return Object.fromEntries(
    Object.entries(checks).filter(([, message]) => message !== null),
  ) as FieldErrors
}