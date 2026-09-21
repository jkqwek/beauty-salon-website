const API_URL = "/api" // в dev проксируется на Django (vite.config.ts)

export const AUTH_LOST_EVENT = "auth:lost"

const ACCESS_KEY = "allure_access"
const REFRESH_KEY = "allure_refresh"

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors: Record<string, string[]>

  constructor(
    status: number,
    message: string,
    code = "error",
    fieldErrors: Record<string, string[]> = {},
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function toApiError(e: unknown): ApiError {
  return e instanceof ApiError
    ? e
    : new ApiError(0, "Неизвестная ошибка. Попробуйте ещё раз.", "unknown")
}

/** Ошибки полей с сервера -> по одному сообщению на поле */
export function fieldMessages(e: ApiError): Record<string, string> {
  return Object.fromEntries(
    Object.entries(e.fieldErrors).map(([field, msgs]) => [field, msgs[0]]),
  )
}

/** Ошибка первого поля, а если её нет — общее сообщение */
export function errorText(e: ApiError): string {
  return Object.values(e.fieldErrors)[0]?.[0] ?? e.message
}

function messageForStatus(status: number): string {
  if (status >= 500) return "Сервер временно недоступен. Попробуйте позже."
  const messages: Record<number, string> = {
    400: "Некорректный запрос. Проверьте введённые данные.",
    401: "Нужно войти в аккаунт.",
    403: "Недостаточно прав для этого действия.",
    404: "Ничего не найдено.",
    429: "Слишком много запросов. Подождите немного.",
  }
  return messages[status] ?? "Что-то пошло не так. Попробуйте ещё раз."
}

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null
  try {
    body = await res.json()
  } catch {
    // не JSON (HTML-страница, ответ прокси) — возьмём текст по статусу
  }
  // detail — наш формат; error — старый формат из cancel/reschedule
  const text = body?.detail ?? body?.error
  const message =
    res.status < 500 && typeof text === "string" ? text : messageForStatus(res.status)
  return new ApiError(res.status, message, body?.code ?? "error", body?.errors ?? {})
}

let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return false
  const data = await res.json()
  tokens.set(data.access, data.refresh) // refresh приходит только при включённой ротации
  return true
}

// Несколько запросов получили 401 одновременно — обновляем токен один раз
function refreshAccessToken() {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  auth?: boolean // false — не отправлять токен (вход, регистрация)
}

export async function api<T>(
  path: string,
  { method = "GET", body, auth = true }: RequestOptions = {},
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = { Accept: "application/json" }
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res: Response
  try {
    res = await send()

    // 401 = access-токен просрочен: обновляем и повторяем запрос один раз
    if (res.status === 401 && auth && (tokens.access || tokens.refresh)) {
      if (!(await refreshAccessToken())) {
        tokens.clear()
        window.dispatchEvent(new Event(AUTH_LOST_EVENT))
      }
      res = await send()
    }
  } catch {
    throw new ApiError(
      0,
      "Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.",
      "network_error",
    )
  }

  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}