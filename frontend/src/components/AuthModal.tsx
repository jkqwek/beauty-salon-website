import { useState, type FormEvent } from "react"
import { X } from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { fieldMessages, toApiError } from "@/api/client"
import { collectErrors, validators, type FieldErrors } from "@/lib/validators"

interface Props {
  onClose: () => void
  onSuccess: () => void
}

const EMPTY = { username: "", email: "", password: "", password2: "" }

export function AuthModal({ onClose, onSuccess }: Props) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [field]: e.target.value })
    if (errors[field]) setErrors({ ...errors, [field]: "" })
  }

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login")
    setErrors({})
    setFormError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    // 1) проверка на клиенте
    const clientErrors =
      mode === "login"
        ? collectErrors({
            username: values.username.trim() ? null : "Введите имя пользователя",
            password: values.password ? null : "Введите пароль",
          })
        : collectErrors({
            username: validators.username(values.username),
            email: validators.email(values.email),
            password: validators.password(values.password),
            password2: validators.passwordRepeat(values.password2, values.password),
          })
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) return

    // 2) запрос; сервер проверит ещё раз и вернёт свои ошибки по полям
    setSubmitting(true)
    try {
      if (mode === "login") {
        await login(values.username.trim(), values.password)
      } else {
        await register({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          password2: values.password2,
        })
      }
      onSuccess()
    } catch (err) {
      const apiError = toApiError(err)
      const fields = fieldMessages(apiError)
      setErrors(fields)
      // ошибка не про поля формы — показываем общим сообщением
      if (!Object.keys(fields).some((f) => f in values)) setFormError(apiError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const field = (
    name: keyof typeof EMPTY,
    label: string,
    type = "text",
    autoComplete?: string,
  ) => (
    <div className="space-y-1.5">
      <label htmlFor={`auth-${name}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={`auth-${name}`}
        type={type}
        value={values[name]}
        onChange={set(name)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[name])}
        className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-1 transition-shadow ${
          errors[name]
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500"
            : "border-rose-200 focus:border-gold focus:ring-gold"
        }`}
      />
      {errors[name] && <p className="text-sm text-rose-600">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-rose-50 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between">
          <h2 className="text-2xl font-serif text-foreground">
            {mode === "login" ? "Вход" : "Регистрация"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} noValidate className="p-6 md:p-8 space-y-4">
          {formError && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-white p-3 text-sm text-rose-700">
              {formError}
            </div>
          )}

          {field("username", "Имя пользователя", "text", "username")}
          {mode === "register" && field("email", "Email", "email", "email")}
          {field("password", "Пароль", "password", mode === "login" ? "current-password" : "new-password")}
          {mode === "register" && field("password2", "Повторите пароль", "password", "new-password")}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Подождите…" : mode === "login" ? "Войти" : "Зарегистрироваться"}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button type="button" onClick={switchMode} className="text-gold font-medium hover:underline">
              {mode === "login" ? "Зарегистрироваться" : "Войти"}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}