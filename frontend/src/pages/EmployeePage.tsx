import { useState } from "react"
import { useAuth } from "@/auth/AuthContext"
import { employeeApi, type Booking, type CabinetClient } from "@/api/api"
import { useApi } from "@/api/useApi"
import { toApiError, type ApiError } from "@/api/client"
import { formatDate, formatTime } from "@/lib/format"
import { ErrorMessage } from "../components/ErrorMessage"
import { AlertCircle, Calendar, Clock, User } from "lucide-react"

/** ISO datetime -> "10:05" */
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })

const minutesBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 60000)

export function EmployeePage() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(employeeApi.cabinet, [user?.id])
  const [actionError, setActionError] = useState<ApiError | null>(null)

  const track = async (bookingId: number) => {
    setActionError(null)
    try {
      await employeeApi.trackTime(bookingId)
      reload()
    } catch (e) {
      setActionError(toApiError(e))
    }
  }

  const clientById = new Map(data?.clients.map((c) => [c.id, c] as const))
  const todayBookings = data?.bookings.filter((b) => b.date === data.today) ?? []
  const upcoming = data?.bookings.filter((b) => b.date !== data.today) ?? []

  const renderBookings = (list: Booking[], empty: string) =>
    list.length === 0 ? (
      <p className="text-muted-foreground mb-8">{empty}</p>
    ) : (
      <div className="space-y-4 mb-10">
        {list.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            client={clientById.get(b.client)}
            canTrack={b.date === data?.today && b.status === "active"}
            onTrack={() => track(b.id)}
          />
        ))}
      </div>
    )

  return (
    <div>
      <h1 className="text-3xl font-serif text-foreground mb-1">Мой кабинет</h1>
      <p className="text-muted-foreground mb-8">{data?.employee}</p>

      <div>
        {loading && !data && <p className="text-muted-foreground">Загрузка…</p>}
        {error && <ErrorMessage error={error} onRetry={reload} />}
        {actionError && <ErrorMessage error={actionError} />}

        {data && (
          <div className="flex flex-col md:flex-row gap-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-serif text-foreground mb-6">Сегодня</h2>
              {renderBookings(todayBookings, "На сегодня записей нет.")}

              <h2 className="text-2xl font-serif text-foreground mb-6">Предстоящие записи</h2>
              {renderBookings(upcoming, "Предстоящих записей нет.")}

              <h2 className="text-2xl font-serif text-foreground mb-6">Мои клиенты</h2>
              {data.clients.length === 0 ? (
                <p className="text-muted-foreground">Клиентов пока нет.</p>
              ) : (
                <div className="space-y-4">
                  {data.clients.map((c) => (
                    <ClientRow key={c.id} client={c} onSaved={reload} />
                  ))}
                </div>
              )}
            </div>

            <aside className="w-full md:w-64 shrink-0">
              <div className="bg-white rounded-3xl border border-rose-100 p-6">
                <h2 className="text-lg font-serif text-foreground mb-4">График работы</h2>
                {data.schedule.length === 0 && (
                  <p className="text-sm text-muted-foreground">График не задан.</p>
                )}
                <ul className="space-y-2 text-sm">
                  {data.schedule.map((s) => (
                    <li key={s.day} className="flex justify-between">
                      <span>{s.day}</span>
                      <span className="text-muted-foreground">
                        {formatTime(s.start_time)}–{formatTime(s.end_time)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function BookingCard({
  booking: b,
  client,
  canTrack,
  onTrack,
}: {
  booking: Booking
  client?: CabinetClient
  canTrack: boolean
  onTrack: () => void
}) {
  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-gold font-medium mb-1">
          <Calendar className="size-4" /> {formatDate(b.date)} • {formatTime(b.start_time)}–
          {formatTime(b.end_time)}
        </div>
        <h3 className="text-xl font-serif text-foreground mb-1">{b.service_name}</h3>
        <p className="text-muted-foreground flex items-center gap-2">
          <User className="size-4" /> {client?.name}
        </p>
        {client?.note && (
          <p className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 text-sm">
            <AlertCircle className="size-4 shrink-0" /> {client.note}
          </p>
        )}
        {b.actual_start && (
          <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
            <Clock className="size-4" /> Факт: {clock(b.actual_start)}–
            {b.actual_end
              ? `${clock(b.actual_end)} (${minutesBetween(b.actual_start, b.actual_end)} мин)`
              : "в процессе"}
          </p>
        )}
      </div>

      {canTrack && (
        <button
          onClick={onTrack}
          className="shrink-0 px-6 py-2 rounded-full bg-gold text-white font-medium hover:bg-gold-hover transition-colors"
        >
          {b.actual_start ? "Завершить" : "Начать"}
        </button>
      )}
    </div>
  )
}

function ClientRow({ client, onSaved }: { client: CabinetClient; onSaved: () => void }) {
  const [text, setText] = useState(client.note)
  const [saved, setSaved] = useState(client.note)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      setSaved((await employeeApi.saveNote(client.id, text)).note ?? "")
      onSaved() // обновить пометки в карточках записей
    } catch (e) {
      setError(toApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-serif text-foreground">{client.name}</h3>
          {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
        </div>
        <span className="text-sm text-muted-foreground">Визитов: {client.visits}</span>
      </div>
      <label className="text-sm font-medium text-foreground" htmlFor={`note-${client.id}`}>
        Внутренний комментарий (клиент его не видит)
      </label>
      <textarea
        id={`note-${client.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Например: аллергия на аммиак, любит кофе"
        className="mt-2 w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"
      />
      {error && <ErrorMessage error={error} />}
      <button
        onClick={save}
        disabled={saving || text === saved}
        className="mt-3 px-6 py-2 rounded-full border border-gold text-gold font-medium hover:bg-gold/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  )
}
