import { useState, type FormEvent } from "react"
import { useOutletContext, useSearchParams } from "react-router"
import { useAuth } from "@/auth/AuthContext"
import { authApi, bookingApi, catalogApi, type Booking, type ProfileData, type User as UserType } from "@/api/api"
import { useApi } from "@/api/useApi"
import { fieldMessages, toApiError, type ApiError } from "@/api/client"
import { formatDate, formatPrice, formatTime, hoursUntil, plural, relativeDay } from "@/lib/format"
import { collectErrors, validators } from "@/lib/validators"
import { Avatar } from "../components/Avatar"
import { AvatarCropper } from "../components/AvatarCropper"
import type { BookingPrefill } from "../components/BookingWizard"
import { ErrorMessage } from "../components/ErrorMessage"
import { StatusBadge, isActiveStatus } from "../components/StatusBadge"
import { RescheduleModal, ReviewModal } from "../components/ClientModals"
import { Bell, Calendar, Camera, Clock, Gift, RotateCcw, User, type LucideIcon } from "lucide-react"

const REVIEW_BADGE: Record<NonNullable<Booking["review_status"]>, { label: string; cls: string }> = {
  new: { label: "Отзыв на модерации", cls: "bg-yellow-50 text-yellow-800 border-yellow-200" },
  published: { label: "Отзыв опубликован", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Отзыв не опубликован", cls: "bg-rose-50 text-muted-foreground border-rose-200" },
}

type Tab = "bookings" | "history" | "bonus" | "profile"

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "bookings", label: "Мои записи", icon: Calendar },
  { id: "history", label: "История визитов", icon: Clock },
  { id: "bonus", label: "Бонусы", icon: Gift },
  { id: "profile", label: "Редактировать профиль", icon: User },
]

const POINTS: [string, string, string] = ["балл", "балла", "баллов"]

export function ProfilePage() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "bookings"
  const setTab = (id: Tab) => setParams({ tab: id })

  const { user, refreshUser } = useAuth()
  const { openAuth, rebook } = useOutletContext<{ openAuth: () => void; rebook: (p: BookingPrefill) => void }>()
  const bookings = useApi(bookingApi.my, [user?.id])
  const services = useApi(catalogApi.services) // «Записаться снова» — только на услуги, которые ещё есть
  const policy = useApi(bookingApi.cancellationPolicy)
  const [cancelError, setCancelError] = useState<ApiError | null>(null)
  const [rescheduling, setRescheduling] = useState<Booking | null>(null)
  const [reviewing, setReviewing] = useState<Booking | null>(null)

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

  const isUpcoming = (b: Booking) => isActiveStatus(b.status) && hoursUntil(b.date, b.start_time) > 0
  const upcoming = (bookings.data ?? []).filter(isUpcoming).reverse() // ближайшая — первой
  const history = (bookings.data ?? []).filter((b) => !isUpcoming(b))
  const completed = history.filter((b) => b.status === "completed")
  const spent = completed.reduce((sum, b) => sum + Number(b.price ?? 0), 0)
  const serviceIds = new Set((services.data ?? []).map((s) => s.id))
  const nearest = upcoming[0]
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username

  const changed = () => {
    bookings.reload()
    refreshUser() // напоминание в шапке
  }

  const cancel = async (id: number) => {
    if (!confirm("Отменить запись?")) return
    setCancelError(null)
    try {
      await bookingApi.cancel(id)
      changed()
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
            <button
              onClick={() => setTab("bonus")}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold-dark text-sm font-medium hover:bg-gold/20 transition-colors"
            >
              <Gift className="size-4" /> {plural(user.bonus_balance, POINTS)}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-10">
        {nearest && <NextBookingCard booking={nearest} onMore={tab === "bookings" ? null : () => setTab("bookings")} />}

        <div className="flex flex-col md:flex-row gap-10">
          {/* Sidebar */}
          <aside className="w-full md:w-64 shrink-0">
            <nav className="bg-white rounded-3xl border border-rose-100 overflow-hidden flex flex-col p-2">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-left font-medium transition-colors ${
                    tab === id ? "bg-rose-50 text-gold" : "text-muted-foreground hover:bg-rose-50/50"
                  }`}
                >
                  <Icon className="size-5" /> {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {tab === "bookings" && (
              <div>
                <h2 className="text-2xl font-serif text-foreground mb-6">
                  Мои записи
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
                        <button
                          onClick={() => setRescheduling(b)}
                          className="px-6 py-2 rounded-full border border-gold text-gold font-medium hover:bg-gold/10 transition-colors"
                        >
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

            {tab === "history" && (
              <div>
                <h2 className="text-2xl font-serif text-foreground mb-6">
                  История визитов
                </h2>

                {bookings.loading && <p className="text-muted-foreground">Загрузка…</p>}
                {bookings.error && <ErrorMessage error={bookings.error} onRetry={bookings.reload} />}
                {bookings.data && history.length === 0 && (
                  <p className="text-muted-foreground">Визитов пока нет.</p>
                )}

                {history.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <SummaryTile label="Визитов" value={String(completed.length)} />
                    <SummaryTile label="Потрачено всего" value={formatPrice(String(spent))} />
                    <SummaryTile
                      label="Средний чек"
                      value={completed.length ? formatPrice(String(Math.round(spent / completed.length))) : "—"}
                    />
                  </div>
                )}

                <div className="space-y-4">
                  {history.map((visit) => {
                    const cancelled = visit.status === "cancelled"
                    const canRebook = (cancelled || visit.status === "completed") && serviceIds.has(visit.service)
                    return (
                      <div
                        key={visit.id}
                        className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className={cancelled ? "opacity-60" : ""}>
                          <h3 className="text-lg font-serif text-foreground mb-1">
                            {visit.service_name}
                          </h3>

                          <p className="text-sm text-muted-foreground mb-2">
                            {formatDate(visit.date)} • {visit.employee_name}
                          </p>

                          <StatusBadge status={visit.status} />
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-3">
                          {visit.status === "completed" && visit.price && (
                            <p className="text-xl font-serif text-foreground">{formatPrice(visit.price)}</p>
                          )}
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {canRebook && (
                              <button
                                onClick={() => rebook({ serviceId: visit.service, employeeId: visit.employee })}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-gold hover:bg-gold-hover text-white text-sm font-medium transition-colors whitespace-nowrap"
                              >
                                <RotateCcw className="size-4" /> Записаться снова
                              </button>
                            )}
                            {visit.review_status ? (
                              <span
                                className={`px-3 py-2 rounded-full border text-xs font-medium whitespace-nowrap ${REVIEW_BADGE[visit.review_status].cls}`}
                              >
                                {REVIEW_BADGE[visit.review_status].label}
                              </span>
                            ) : (
                              visit.status === "completed" && (
                                <button
                                  onClick={() => setReviewing(visit)}
                                  className="px-5 py-2 rounded-full border border-gold text-gold text-sm font-medium hover:bg-gold/10 transition-colors whitespace-nowrap"
                                >
                                  Оставить отзыв
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {tab === "bonus" && <BonusTab balance={user.bonus_balance} />}

            {tab === "profile" && (
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

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            changed()
          }}
        />
      )}
      {reviewing && (
        <ReviewModal
          booking={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null)
            bookings.reload()
          }}
        />
      )}
    </div>
  )
}

/** Напоминание о ближайшей записи; меньше суток до визита — выделено ярче */
function NextBookingCard({ booking: b, onMore }: { booking: Booking; onMore: (() => void) | null }) {
  const urgent = hoursUntil(b.date, b.start_time) <= 24
  return (
    <div
      role="status"
      className={`mb-8 rounded-3xl border p-5 flex flex-wrap items-center gap-4 ${
        urgent ? "bg-gold/10 border-gold shadow-sm" : "bg-white border-rose-100"
      }`}
    >
      <div
        className={`size-12 rounded-full flex items-center justify-center shrink-0 ${
          urgent ? "bg-gold text-white" : "bg-rose-50 text-gold"
        }`}
      >
        <Bell className="size-6" />
      </div>
      <div className="flex-1 min-w-48">
        <p className="font-medium text-foreground flex flex-wrap items-center gap-2">
          Ближайшая запись: {relativeDay(b.date)} в {formatTime(b.start_time)}
          <StatusBadge status={b.status} />
        </p>
        <p className="text-sm text-muted-foreground">
          {b.service_name} · мастер {b.employee_name}
        </p>
      </div>
      {onMore && (
        <button onClick={onMore} className="text-sm font-medium text-gold-dark hover:underline">
          Подробнее
        </button>
      )}
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-rose-100 p-5">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-serif text-foreground">{value}</p>
    </div>
  )
}

/** Баланс, правило программы и история начислений и списаний */
function BonusTab({ balance }: { balance: number }) {
  const bonus = useApi(authApi.bonus, [balance])
  return (
    <div>
      <h2 className="text-2xl font-serif text-foreground mb-6">Бонусы</h2>

      <div className="bg-white border border-gold/40 rounded-3xl p-8 shadow-sm mb-8 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="size-16 rounded-full bg-gold/10 text-gold flex items-center justify-center shrink-0">
          <Gift className="size-8" />
        </div>
        <div>
          <p className="text-4xl font-serif text-foreground">{plural(balance, POINTS)}</p>
          {bonus.data && (
            <p className="text-muted-foreground mt-2">
              {bonus.data.percent}% от стоимости каждого визита возвращается баллами, 1 балл = 1 ₽.
              Потратить баллы можно при оплате в салоне — скажите об этом администратору.
            </p>
          )}
        </div>
      </div>

      <h3 className="text-xl font-serif text-foreground mb-4">История операций</h3>
      {bonus.loading && !bonus.data && <p className="text-muted-foreground">Загрузка…</p>}
      {bonus.error && <ErrorMessage error={bonus.error} onRetry={bonus.reload} />}
      {bonus.data?.operations.length === 0 && (
        <p className="text-muted-foreground">Операций пока нет. Баллы начислятся после первого визита.</p>
      )}
      {!!bonus.data?.operations.length && (
        <ul className="bg-white border border-rose-100 rounded-3xl divide-y divide-rose-50">
          {bonus.data.operations.map((op) => (
            <li key={op.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <div>
                <p className="text-foreground">{op.comment}</p>
                <p className="text-xs text-muted-foreground">{formatDate((op.visit_date ?? op.created_at).slice(0, 10))}</p>
              </div>
              <span className={`font-medium whitespace-nowrap ${op.amount > 0 ? "text-green-700" : "text-rose-600"}`}>
                {op.amount > 0 ? "+" : "−"}
                {Math.abs(op.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
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
    const found = collectErrors({ email: validators.email(values.email), phone: validators.phone(values.phone) })
    if (Object.keys(found).length) return setErrors(found)
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

  const field = (key: keyof ProfileData, label: string, type: string, autoComplete: string, placeholder?: string) => (
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
        placeholder={placeholder}
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
          {field("phone", "Телефон", "tel", "tel", "+7 900 123-45-67")}
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
