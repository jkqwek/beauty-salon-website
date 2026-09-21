import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { authApi, type RegisterData, type User } from "@/api/api"
import { ApiError, AUTH_LOST_EVENT, tokens } from "@/api/client"

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(tokens.access || tokens.refresh))

  // После перезагрузки страницы восстанавливаем сессию по токенам
  useEffect(() => {
    if (!loading) return
    authApi
      .me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // api() сообщает, что сессия окончательно протухла
  useEffect(() => {
    const onLost = () => setUser(null)
    window.addEventListener(AUTH_LOST_EVENT, onLost)
    return () => window.removeEventListener(AUTH_LOST_EVENT, onLost)
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const t = await authApi.login(username, password)
      tokens.set(t.access, t.refresh)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        throw new ApiError(401, "Неверное имя пользователя или пароль.", "invalid_credentials")
      }
      throw e
    }
    setUser(await authApi.me())
  }

  const register = async (data: RegisterData) => {
    await authApi.register(data)
    await login(data.username, data.password) // после регистрации сразу входим
  }

  const logout = () => {
    tokens.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth нужно вызывать внутри <AuthProvider>")
  return ctx
}