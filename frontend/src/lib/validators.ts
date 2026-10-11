// Клиентская проверка — только подсказка пользователю. Настоящая проверка на сервере.

export type FieldErrors = Record<string, string>

export const validators = {
  username(value: string): string | null {
    const v = value.trim()
    if (!v) return "Введите имя пользователя"
    if (v.length < 3) return "Не короче 3 символов"
    if (v.length > 150) return "Не длиннее 150 символов"
    if (!/^[\p{L}\p{N}_.@+-]+$/u.test(v)) return "Только буквы, цифры и символы @ . + - _"
    return null
  },

  email(value: string): string | null {
    const v = value.trim()
    if (!v) return "Введите email"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Введите корректный email"
    return null
  },

  password(value: string): string | null {
    if (!value) return "Введите пароль"
    if (value.length < 8) return "Не короче 8 символов"
    if (/^\d+$/.test(value)) return "Пароль не может состоять только из цифр"
    return null
  },

  passwordRepeat(value: string, original: string): string | null {
    return value === original ? null : "Пароли не совпадают"
  },
}

export function collectErrors(checks: Record<string, string | null>): FieldErrors {
  return Object.fromEntries(
    Object.entries(checks).filter(([, message]) => message !== null),
  ) as FieldErrors
}