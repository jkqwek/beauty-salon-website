import { useState, type FormEvent } from "react"
import { useOutletContext } from "react-router"
import { useAuth } from "@/auth/AuthContext"
import { authApi, bookingApi, type Booking, type ProfileData, type User as UserType } from "@/api/api"
import { useApi } from "@/api/useApi"
import { fieldMessages, toApiError, type ApiError } from "@/api/client"
import { formatDate, formatTime } from "@/lib/format"
import { validators } from "@/lib/validators"
import { Avatar } from "../components/Avatar"
import { AvatarCropper } from "../components/AvatarCropper"
import { ErrorMessage } from "../components/ErrorMessage"
import { StatusBadge, isActiveStatus } from "../components/StatusBadge"
import { User, Calendar, Camera, Clock, MoreVertical } from "lucide-react"

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState("appointments")

  const { user } = useAuth()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const bookings = useApi(bookingApi.my, [user?.id])
  const policy = useApi(bookingApi.cancellationPolicy)
  const [cancelError, setCancelError] = useState<ApiError | null>(null)

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
    isActiveStatus(b.status) && new Date(`${b.date}T${b.start_time}`) > new Date()
  const upcoming = (bookings.data ?? []).filter(isUpcoming)
  const history = (bookings.data ?? []).filter((b) => !isUpcoming(b))
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username

  const cancel = async (id: number) => {
    if (!confirm("Отменить запись?")) return
    setCancelError(null)
    try {
      await bookingApi.cancel(id)
      bookings.reload()
    } catch (e) {
      setCancelError(toApiError(e)) // например, поздно по правилу отмены
    }
  }

  return (
    <div className="flex-1 bg-pearl pb-24">
      {/* Header */}
      <div className="bg-rose-50 border-b border-rose-100 py-12 px-6">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <Avatar src={user.avatar} name={displayName} className="size-24 text-3xl font-serif border-2 border-gold" />
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

              {policy.data && (
                <p className="text-sm text-muted-foreground -mt-4 mb-6">
                  {policy.data.deadline_hours
                    ? `Отменить или перенести запись можно не позднее чем за ${policy.data.deadline_hours} ч до визита.`
                    : "Отменить или перенести запись можно в любой момент до начала визита."}
                </p>
              )}

              {cancelError && <ErrorMessage error={cancelError} />}

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
                      <div className="flex flex-wrap items-center gap-2 text-gold font-medium mb-1">
                        <Calendar className="size-4" />{" "}
                        {formatDate(b.date)} • {formatTime(b.start_time)}
                        <StatusBadge status={b.status} />
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

                      <button
                        onClick={() => cancel(b.id)}
                        className="px-6 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 transition-colors"
                      >
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

                      <StatusBadge status={visit.status} />
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

              <ProfileForm user={user} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

/** Свой профиль: имя, фамилия, email, телефон и фото — всё сохраняется на сервер */
function ProfileForm({ user }: { user: UserType }) {
  const { updateUser } = useAuth()
  const fromUser = (u: UserType): ProfileData => ({
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    phone: u.phone ?? "",
  })
  const [values, setValues] = useState<ProfileData>(() => fromUser(user))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username

  const set = (field: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [field]: e.target.value })
    setSaved(false)
    if (errors[field]) setErrors({ ...errors, [field]: "" })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const emailError = validators.email(values.email)
    if (emailError) return setErrors({ email: emailError })
    setSaving(true)
    setFormError(null)
    try {
      const updated = await authApi.updateMe({ ...values, email: values.email.trim() })
      updateUser(updated)
      setValues(fromUser(updated))
      setSaved(true)
    } catch (err) {
      const apiError = toApiError(err)
      const fields = fieldMessages(apiError)
      setErrors(fields)
      if (!Object.keys(fields).some((f) => f in values)) setFormError(apiError.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof ProfileData, label: string, type: string, autoComplete: string) => (
    <div className="space-y-2">
      <label htmlFor={`profile-${key}`} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={`profile-${key}`}
        type={type}
        value={values[key]}
        onChange={set(key)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[key])}
        className={`w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-1 transition-shadow ${
          errors[key] ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500" : "border-rose-200 focus:border-gold focus:ring-gold"
        }`}
      />
      {errors[key] && <p className="text-sm text-rose-600">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-8 shadow-sm">
      <div className="flex items-center gap-6 mb-8 pb-8 border-b border-rose-100">
        <button type="button" onClick={() => setPhotoOpen(true)} aria-label="Изменить фото профиля" className="relative group rounded-full">
          <Avatar src={user.avatar} name={name} className="size-24 text-3xl font-serif" />
          <span className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="size-6 text-white" />
          </span>
        </button>
        <div>
          <h3 className="text-lg font-medium text-foreground mb-1">Фото профиля</h3>
          <p className="text-sm text-muted-foreground mb-2">JPG или PNG, до 10 МБ.</p>
          <button type="button" onClick={() => setPhotoOpen(true)} className="text-sm font-medium text-gold-dark hover:underline">
            {user.avatar ? "Изменить или удалить" : "Загрузить фото"}
          </button>
        </div>
      </div>

      <form onSubmit={submit} noValidate className="space-y-6">
        {formError && <ErrorMessage error={formError} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {field("first_name", "Имя", "text", "given-name")}
          {field("last_name", "Фамилия", "text", "family-name")}
          {field("email", "Email", "email", "email")}
          {field("phone", "Телефон", "tel", "tel")}
        </div>
        <div className="pt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gold text-white font-medium px-8 py-3 rounded-full hover:bg-gold-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Сохранение…" : "Сохранить изменения"}
          </button>
          {saved && <span className="text-sm text-green-700">Сохранено</span>}
        </div>
      </form>

      {photoOpen && (
        <AvatarCropper
          title="Фото профиля"
          hasPhoto={Boolean(user.avatar)}
          onSave={async (blob) => updateUser(await authApi.uploadAvatar(blob))}
          onDelete={async () => updateUser(await authApi.deleteAvatar())}
          onClose={() => setPhotoOpen(false)}
        />
      )}
    </div>
  )
}
