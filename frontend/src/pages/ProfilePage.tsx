import { useState } from "react"
import { useOutletContext } from "react-router"
import { useAuth } from "@/auth/AuthContext"
import { bookingApi, type Booking } from "@/api/api"
import { useApi } from "@/api/useApi"
import { formatDate, formatTime } from "@/lib/format"
import { ErrorMessage } from "../components/ErrorMessage"
import {
  User,
  Calendar,
  Clock,
  CheckCircle2,
  MoreVertical,
  Upload,
} from "lucide-react"

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState("appointments")

  const { user } = useAuth()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const bookings = useApi(bookingApi.my, [user?.id])

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-center px-6">
        <h1 className="text-3xl font-serif text-foreground">Личный кабинет</h1>
        <p className="text-muted-foreground">Войдите, чтобы увидеть свои записи.</p>
        <button
          onClick={openAuth}
          className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors"
        >
          Войти
        </button>
      </div>
    )
  }

  const isUpcoming = (b: Booking) =>
    b.status === "active" && new Date(`${b.date}T${b.start_time}`) > new Date()
  const upcoming = (bookings.data ?? []).filter(isUpcoming)
  const history = (bookings.data ?? []).filter((b) => !isUpcoming(b))
  const STATUS: Record<Booking["status"], string> = {
    active: "Прошла",
    cancelled: "Отменена",
    completed: "Завершена",
  }
  const displayName = user.first_name || user.username

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <div className="size-24 rounded-full bg-white border-2 border-gold flex items-center justify-center text-gold text-3xl font-serif">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-serif text-foreground mb-1">
              {displayName}
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-10 flex flex-col md:flex-row gap-10">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="bg-white rounded-3xl border border-rose-100 overflow-hidden flex flex-col p-2">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "appointments"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <Calendar className="size-5" /> Записи
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <Clock className="size-5" /> История визитов
            </button>

            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-rose-50 text-gold"
                  : "text-muted-foreground hover:bg-rose-50/50"
              }`}
            >
              <User className="size-5" /> Редактировать профиль
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1">
          {activeTab === "appointments" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                Ближайшие записи
              </h2>

              {bookings.loading && (
                <p className="text-muted-foreground">Загрузка…</p>
              )}

              {bookings.error && (
                <ErrorMessage
                  error={bookings.error}
                  onRetry={bookings.reload}
                />
              )}

              {!bookings.loading && !bookings.error && upcoming.length === 0 && (
                <p className="text-muted-foreground">
                  Предстоящих записей нет.
                </p>
              )}

              <div className="space-y-4">
                {upcoming.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white border border-gold/30 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gold"></div>

                    <div>
                      <div className="flex items-center gap-2 text-gold font-medium mb-1">
                        <Calendar className="size-4" />{" "}
                        {formatDate(b.date)} • {formatTime(b.start_time)}
                      </div>

                      <h3 className="text-xl font-serif text-foreground mb-2">
                        {b.service_name}
                      </h3>

                      <p className="text-muted-foreground flex items-center gap-2">
                        <User className="size-4" /> {b.employee_name}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button className="px-6 py-2 rounded-full border border-gold text-gold font-medium hover:bg-gold/10 transition-colors">
                        Перенести
                      </button>

                      <button className="px-6 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 transition-colors">
                        Отменить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                История визитов
              </h2>

              <div className="space-y-4">
                {history.map((visit) => (
                  <div
                    key={visit.id}
                    className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-serif text-foreground mb-1">
                        {visit.service_name}
                      </h3>

                      <p className="text-sm text-muted-foreground mb-2">
                        {formatDate(visit.date)} • {visit.employee_name}
                      </p>

                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                        <CheckCircle2 className="size-3" />{" "}
                        {STATUS[visit.status]}
                      </span>
                    </div>

                    <button className="text-muted-foreground hover:text-gold transition-colors p-2">
                      <MoreVertical className="size-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <h2 className="text-2xl font-serif text-foreground mb-6">
                Редактировать профиль
              </h2>

              <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-6 mb-8 pb-8 border-b border-rose-100">
                  <div className="relative group cursor-pointer">
                    <div className="size-24 rounded-full bg-rose-50 border-2 border-dashed border-rose-200 flex items-center justify-center text-rose-300">
                      <User className="size-10" />
                    </div>

                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Upload className="size-6 text-white" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      Фото профиля
                    </h3>

                    <p className="text-sm text-muted-foreground">
                      JPG, GIF или PNG. Не больше 2 МБ.
                    </p>
                  </div>
                </div>

                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Имя
                      </label>

                      <input
                        type="text"
                        defaultValue="Анна"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Фамилия
                      </label>

                      <input
                        type="text"
                        defaultValue="Смирнова"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Email
                      </label>

                      <input
                        type="email"
                        defaultValue="anna@example.com"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Телефон
                      </label>

                      <input
                        type="tel"
                        defaultValue="+7 (999) 123-45-67"
                        className="w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      className="bg-gold text-white font-medium px-8 py-3 rounded-full hover:bg-gold-hover transition-colors shadow-sm"
                    >
                      Сохранить изменения
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
