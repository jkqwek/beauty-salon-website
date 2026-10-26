import { useEffect, useState, type FormEvent } from "react"
import { NavLink, Outlet } from "react-router"
import {
  BadgePercent,
  Ban,
  Calendar,
  CalendarOff,
  CalendarClock,
  CalendarX2,
  Camera,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Gift,
  LayoutGrid,
  MessageSquareText,
  Package,
  Receipt,
  RotateCcw,
  Scissors,
  Star,
  User,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import {
  adminApi,
  bookingApi,
  catalogApi,
  type Booking,
  type Employee,
  type PanelCounters,
  type ReviewPhoto,
  type SalonLoad,
} from "@/api/api"
// ДОБАВЛЕН ИМПОРТ tokens
import { toApiError, tokens, type ApiError } from "@/api/client"
import { useApi } from "@/api/useApi"
import {
  formatDate,
  formatDayHeader,
  formatPrice,
  formatTime,
  periodLabel,
  periodRange,
  plural,
  shiftDate,
  shiftPeriod,
  toIsoDate,
  type PeriodMode,
} from "@/lib/format"
import { masterPhoto } from "@/lib/photos"
import { Avatar } from "../components/Avatar"
import { AvatarCropper } from "../components/AvatarCropper"
import { CrudTable, INPUT, downloadCsv, exportButton, type Option, type Row, type RowActions, type Value } from "../components/CrudTable"
import { ErrorMessage } from "../components/ErrorMessage"
import { ModalShell } from "../components/ClientModals"
import { PhotoLightbox } from "../components/ReviewCard"
import { BOOKING_STATUS, COUNTERS_CHANGED } from "../components/StatusBadge"
import { PriceTag } from "../components/PriceTag"
import { StarRating } from "../components/StarRating"
import { EmployeePage } from "./EmployeePage"
import { DashboardPage } from "./DashboardPage"
import { FinancePage } from "./FinancePage"

const DAYS: Option[] = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"].map(
  (label, value) => ({ value, label }),
)

const badge = (text: string, cls: string) => (
  <span className={`inline-block px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${cls}`}>{text}</span>
)

function Loader({ q }: { q: { error: ApiError | null; reload: () => void } }) {
  return q.error ? <ErrorMessage error={q.error} onRetry={q.reload} /> : <p className="text-muted-foreground">Загрузка…</p>
}

/** Мастера для выпадающих списков */
function useMasterOptions() {
  const masters = useApi(catalogApi.employees)
  const options: Option[] | null = masters.data?.map((m) => ({ value: m.id, label: m.full_name })) ?? null
  return { masters, options }
}

/** Выбор дня: ‹ дата › Сегодня */
function DayNav({ day, onChange }: { day: string; onChange: (day: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(shiftDate(day, -1))} aria-label="Предыдущий день" className="p-2 rounded-full bg-white border border-rose-200 hover:border-gold transition-colors">
        <ChevronLeft className="size-4" />
      </button>
      <input
        type="date"
        value={day}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Дата"
        className="px-4 py-2 rounded-full border border-rose-200 bg-white text-sm focus:outline-none focus:border-gold"
      />
      <button onClick={() => onChange(shiftDate(day, 1))} aria-label="Следующий день" className="p-2 rounded-full bg-white border border-rose-200 hover:border-gold transition-colors">
        <ChevronRight className="size-4" />
      </button>
      <button onClick={() => onChange(toIsoDate(new Date()))} className="px-4 py-2 rounded-full text-sm font-medium text-gold hover:bg-gold/10 transition-colors">
        Сегодня
      </button>
    </div>
  )
}

const PERIODS: { mode: PeriodMode; label: string }[] = [
  { mode: "day", label: "Сегодня" },
  { mode: "week", label: "Неделя" },
  { mode: "month", label: "Месяц" },
]

const chipCls = (active: boolean) =>
  `px-4 py-1.5 rounded-full border text-sm font-medium transition-colors ${
    active ? "bg-gold text-white border-gold" : "bg-white text-muted-foreground border-rose-200 hover:border-gold hover:text-foreground"
  }`

/** Статус прямо в строке: цветная «таблетка» с иконкой, внутри — выпадающий список */
function StatusSelect({ status, onChange }: { status: Booking["status"]; onChange: (s: Booking["status"]) => void }) {
  const { cls, icon: Icon } = BOOKING_STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1 pl-2.5 pr-1 rounded-full border text-xs font-medium ${cls}`}>
      <Icon className="size-3.5 shrink-0" />
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as Booking["status"])}
        aria-label="Статус записи"
        className="bg-transparent py-1 focus:outline-none cursor-pointer"
      >
        {Object.entries(BOOKING_STATUS).map(([value, s]) => (
          <option key={value} value={value}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  )
}

function BookingsSection() {
  const today = toIsoDate(new Date())
  const [mode, setMode] = useState<PeriodMode>("day")
  const [anchor, setAnchor] = useState(today)
  const [master, setMaster] = useState<number | null>(null)
  const range = periodRange(mode, anchor)
  const { data, error, reload } = useApi(() => adminApi.bookings(...range), [range[0], range[1]])
  const employees = useApi(catalogApi.employees)
  const [actionError, setActionError] = useState<ApiError | null>(null)

  const setStatus = async (id: number, status: Booking["status"]) => {
    setActionError(null)
    try {
      await adminApi.setBookingStatus(id, status)
      reload()
      window.dispatchEvent(new Event(COUNTERS_CHANGED))
    } catch (e) {
      setActionError(toApiError(e))
    }
  }

  const masters = (employees.data ?? []).filter((m) => m.is_active !== false)
  const rows = (data ?? []).filter((b) => master === null || b.employee === master)
  const days = [...new Set(rows.map((b) => b.date))]
  const revenue = rows.filter((b) => b.status !== "cancelled").reduce((sum, b) => sum + Number(b.price ?? 0), 0)
  const pending = rows.filter((b) => b.status === "pending").length

  const exportCsv = () =>
    downloadCsv(`Записи ${range[0]}${mode === "day" ? "" : `—${range[1]}`}.csv`, [
      ["Дата", "Начало", "Конец", "Клиент", "Постоянный", "Чёрный список", "Услуга", "Мастер", "Цена", "Статус"],
      ...rows.map((b) => [
        b.date,
        formatTime(b.start_time),
        formatTime(b.end_time),
        b.client_name,
        b.client_is_regular ? "Да" : "",
        b.client_is_blocked ? "Да" : "",
        b.service_name,
        b.employee_name,
        b.price ?? "",
        BOOKING_STATUS[b.status].label,
      ]),
    ])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-serif text-foreground">Записи</h1>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.mode}
              onClick={() => {
                setMode(p.mode)
                setAnchor(today)
              }}
              aria-pressed={mode === p.mode}
              className={chipCls(mode === p.mode)}
            >
              {p.mode === "day" && anchor !== today && mode === "day" ? "День" : p.label}
            </button>
          ))}
          <button onClick={() => setAnchor(shiftPeriod(mode, anchor, -1))} aria-label="Предыдущий период" className="p-2 rounded-full bg-white border border-rose-200 hover:border-gold transition-colors">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setAnchor(shiftPeriod(mode, anchor, 1))} aria-label="Следующий период" className="p-2 rounded-full bg-white border border-rose-200 hover:border-gold transition-colors">
            <ChevronRight className="size-4" />
          </button>
          <input
            type="date"
            value={anchor}
            onChange={(e) => {
              if (!e.target.value) return
              setMode("day")
              setAnchor(e.target.value)
            }}
            aria-label="Выбрать день"
            className="px-4 py-2 rounded-full border border-rose-200 bg-white text-sm focus:outline-none focus:border-gold"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ id: null, name: "Все", count: data?.length ?? 0 }, ...masters.map((m) => ({
          id: m.id as number | null,
          name: m.full_name,
          count: (data ?? []).filter((b) => b.employee === m.id).length,
        }))].map((chip) => (
          <button key={chip.id ?? "all"} onClick={() => setMaster(chip.id)} aria-pressed={master === chip.id} className={chipCls(master === chip.id)}>
            {chip.name} <span className="opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <p className="text-muted-foreground mr-auto first-letter:uppercase">
          {periodLabel(mode, range)} · {rows.length} зап. · {formatPrice(String(revenue))}
          {pending > 0 && <span className="ml-2 text-yellow-800">· ждут подтверждения: {pending}</span>}
        </p>
        {exportButton(exportCsv, rows.length === 0)}
      </div>

      {!data && <Loader q={{ error, reload }} />}
      {actionError && <ErrorMessage error={actionError} />}
      {data && rows.length === 0 && <p className="text-muted-foreground">За этот период записей нет.</p>}

      {rows.length > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 text-muted-foreground text-left">
              <tr>
                {["Время", "Клиент", "Услуга", "Мастер", "Цена", "Статус"].map((h) => (
                  <th key={h} className="p-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            {days.map((day) => (
              <tbody key={day}>
                <tr className="border-t border-rose-100 bg-rose-50/50">
                  <th colSpan={6} className="px-4 py-2 text-left font-serif text-base font-normal text-foreground first-letter:uppercase">
                    {formatDayHeader(day)}
                  </th>
                </tr>
                {rows
                  .filter((b) => b.date === day)
                  .map((b) => (
                    <tr key={b.id} className="border-t border-rose-50 hover:bg-rose-50/40 transition-colors">
                      <td className="p-4 whitespace-nowrap font-medium">
                        {formatTime(b.start_time)}–{formatTime(b.end_time)}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {b.client_is_regular && (
                            <span role="img" aria-label="Постоянный клиент" title="Постоянный клиент">
                              <Star className="size-4 fill-gold text-gold" />
                            </span>
                          )}
                          {b.client_name}
                          {b.client_is_blocked && badge("чёрный список", "bg-red-50 text-red-700 border-red-200")}
                        </span>
                      </td>
                      <td className="p-4">{b.service_name}</td>
                      <td className="p-4">{b.employee_name}</td>
                      <td className="p-4 whitespace-nowrap">{b.price ? formatPrice(b.price) : "—"}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusSelect status={b.status} onChange={(s) => setStatus(b.id, s)} />
                          {b.status === "pending" && (
                            <button
                              onClick={() => setStatus(b.id, "confirmed")}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
                            >
                              <Check className="size-3.5" /> Подтвердить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}

type LoadCell = SalonLoad["masters"][number]["cells"][number]

const cellStyle = (c: LoadCell) => {
  if (c.busy) return { backgroundColor: `color-mix(in srgb, var(--color-gold) ${25 + Math.round((75 * Math.min(c.busy, 60)) / 60)}%, white)` }
  if (c.blocked) return { backgroundColor: "var(--color-rose-200)" }
  if (!c.work) return { backgroundColor: "#f1f1f1" }
  return undefined
}

const cellTitle = (c: LoadCell) =>
  [
    `${c.hour}:00–${c.hour + 1}:00`,
    c.work ? null : "нерабочее время",
    c.busy ? `занято ${c.busy} мин` : null,
    c.blocked ? `блокировка ${c.blocked} мин` : null,
  ]
    .filter(Boolean)
    .join(" · ")

function LoadSection() {
  const [day, setDay] = useState(() => toIsoDate(new Date()))
  const { data, error, reload } = useApi(() => adminApi.load(day), [day])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-serif text-foreground">Загрузка салона</h1>
        <DayNav day={day} onChange={setDay} />
      </div>
      <p className="text-muted-foreground mb-6">
        {formatDate(day)} · загрузка салона {data?.load == null ? "—" : `${data.load}%`}
      </p>

      {!data && <Loader q={{ error, reload }} />}
      {data && data.masters.length === 0 && <p className="text-muted-foreground">Работающих мастеров нет.</p>}

      {data && data.masters.length > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 p-6 overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground pr-4">Мастер</th>
                {data.hours.map((h) => (
                  <th key={h} className="font-normal text-xs text-muted-foreground">
                    {h}:00
                  </th>
                ))}
                <th className="text-right font-medium text-muted-foreground pl-4">Загрузка</th>
              </tr>
            </thead>
            <tbody>
              {data.masters.map((m) => (
                <tr key={m.id}>
                  <td className="pr-4 whitespace-nowrap font-medium">{m.name}</td>
                  {m.cells.map((c) => (
                    <td
                      key={c.hour}
                      title={cellTitle(c)}
                      aria-label={cellTitle(c)}
                      style={cellStyle(c)}
                      className="h-10 min-w-10 rounded-lg border border-rose-100"
                    />
                  ))}
                  <td className="pl-4 text-right whitespace-nowrap font-medium">
                    {m.load === null ? <span className="font-normal text-muted-foreground">нет графика</span> : `${m.load}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-5 mt-5 text-xs text-muted-foreground">
            {[
              { label: "Свободно", style: { backgroundColor: "white" } },
              { label: "Занято", style: cellStyle({ hour: 0, work: 60, busy: 60, blocked: 0 }) },
              { label: "Блокировка", style: cellStyle({ hour: 0, work: 60, busy: 0, blocked: 60 }) },
              { label: "Нерабочее время", style: cellStyle({ hour: 0, work: 0, busy: 0, blocked: 0 }) },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-2">
                <span className="size-4 rounded border border-rose-100" style={l.style} /> {l.label}
              </span>
            ))}
            <span>Наведите на ячейку — покажет минуты</span>
          </div>
        </div>
      )}
    </div>
  )
}

const clientName = (r: Row) => [r.first_name, r.last_name].filter(Boolean).join(" ") || r.username

/** ⭐ в один клик. Контурная золотая — подсказка: часто ходит, но ещё не отмечен */
function StarToggle({ row, act }: { row: Row; act: RowActions }) {
  const on = Boolean(row.is_regular)
  const title = on ? "Постоянный клиент — убрать" : row.is_candidate ? "Часто ходит — отметить постоянным?" : "Отметить постоянным"
  return (
    <button onClick={() => act.patch({ is_regular: !on })} title={title} aria-label={title} aria-pressed={on} className="p-1 rounded-full hover:bg-rose-50 transition-colors">
      <Star className={`size-5 ${on ? "fill-gold text-gold" : row.is_candidate ? "text-gold" : "text-rose-200 hover:text-gold"}`} />
    </button>
  )
}

/** Баллы клиента в таблице; по клику — история и ручное начисление или списание */
function BonusCell({ row, act }: { row: Row; act: RowActions }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="История, начислить или списать"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold-dark text-sm font-medium hover:bg-gold/20 transition-colors whitespace-nowrap"
      >
        <Gift className="size-3.5" /> {row.bonus_balance}
      </button>
      {open && (
        <BonusModal
          row={row}
          onClose={(changed) => {
            setOpen(false)
            if (changed) act.reload()
          }}
        />
      )}
    </>
  )
}

function BonusModal({ row, onClose }: { row: Row; onClose: (changed: boolean) => void }) {
  const summary = useApi(() => adminApi.bonus(row.id))
  const [spend, setSpend] = useState(true)
  const [amount, setAmount] = useState("")
  const [comment, setComment] = useState("")
  const [error, setError] = useState<ApiError | string | null>(null)
  const [saving, setSaving] = useState(false)
  const [changed, setChanged] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const points = Number(amount)
    if (!Number.isInteger(points) || points <= 0) return setError("Укажите количество баллов — целое число больше нуля.")
    if (!comment.trim()) return setError("Добавьте комментарий, например «Оплата визита 12.10».")
    setSaving(true)
    setError(null)
    try {
      await adminApi.addBonus(row.id, { amount: spend ? -points : points, comment: comment.trim() })
      setAmount("")
      setComment("")
      setChanged(true)
      summary.reload()
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Баллы: ${clientName(row)}`} onClose={() => onClose(changed)}>
      <p className="text-3xl font-serif text-foreground">
        {summary.data ? plural(summary.data.balance, ["балл", "балла", "баллов"]) : "…"}
      </p>

      <form onSubmit={submit} className="bg-white rounded-2xl border border-rose-100 p-4 space-y-3">
        <div className="flex gap-2">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setSpend(value)}
              aria-pressed={spend === value}
              className={chipCls(spend === value)}
            >
              {value ? "Списать" : "Начислить"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Сколько баллов"
          aria-label="Сколько баллов"
          className={INPUT}
        />
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={200}
          placeholder={spend ? "Оплата визита 12.10" : "Подарок ко дню рождения"}
          aria-label="Комментарий"
          className={INPUT}
        />
        {error && <ErrorMessage error={error} />}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Сохраняем…" : spend ? "Списать баллы" : "Начислить баллы"}
        </button>
      </form>

      <div>
        <h3 className="font-medium text-foreground mb-2">История</h3>
        {summary.error && <ErrorMessage error={summary.error} onRetry={summary.reload} />}
        {summary.data?.operations.length === 0 && <p className="text-sm text-muted-foreground">Операций пока нет.</p>}
        <ul className="divide-y divide-rose-100">
          {summary.data?.operations.map((op) => (
            <li key={op.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span>
                {op.comment}
                <span className="block text-xs text-muted-foreground">
                  {formatDate((op.visit_date ?? op.created_at).slice(0, 10))}
                </span>
              </span>
              <span className={`font-medium whitespace-nowrap ${op.amount > 0 ? "text-green-700" : "text-rose-600"}`}>
                {op.amount > 0 ? "+" : "−"}
                {Math.abs(op.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  )
}

function ClientsSection() {
  const { user } = useAuth()
  return (
    <CrudTable
      title="Клиенты"
      endpoint="/admin/users/"
      canCreate={false}
      canDelete={false}
      filters={[
        { label: "⭐ Постоянные", test: (r) => Boolean(r.is_regular) },
        { label: "☆ Кандидаты", test: (r) => r.is_candidate },
        { label: "Чёрный список", test: (r) => Boolean(r.is_blocked) },
      ]}
      beforeSubmit={(values, row) =>
        row === "new" || !values.is_blocked || Boolean(row.is_blocked) ||
        confirm(`Добавить ${clientName(row)} в чёрный список? Онлайн-запись для клиента станет недоступна.`)
      }
      fields={[
        { name: "is_regular", label: "⭐", type: "checkbox", inForm: false, render: (r, act) => <StarToggle row={r} act={act} /> },
        {
          name: "first_name",
          label: "Имя",
          render: (r) => (
            <div className="flex items-center gap-3 min-w-56">
              <Avatar src={r.avatar} name={clientName(r)} className="size-9 text-xs" />
              <div>
                <p className="font-medium flex flex-wrap items-center gap-2">
                  {clientName(r)}
                  {r.id === user?.id && " (вы)"}
                  {r.is_blocked && (
                    <span title={[r.blocked_reason, r.blocked_at && `с ${formatDate(r.blocked_at.slice(0, 10))}`].filter(Boolean).join(" · ")}>
                      {badge("чёрный список", "bg-red-50 text-red-700 border-red-200")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.username}
                  {r.master && ` · мастер ${r.master}`}
                </p>
              </div>
            </div>
          ),
        },
        { name: "last_name", label: "Фамилия", inTable: false },
        { name: "phone", label: "Телефон", render: (r) => <span className="whitespace-nowrap">{r.phone || "—"}</span> },
        { name: "email", label: "Email", inTable: false },
        {
          name: "is_staff",
          label: "Статус",
          type: "select",
          options: [
            { value: false, label: "Покупатель" },
            { value: true, label: "Сотрудник" },
          ],
          render: (r) =>
            r.is_staff
              ? badge("Сотрудник", "bg-gold/10 text-gold-dark border-gold/30")
              : badge("Покупатель", "bg-rose-50 text-muted-foreground border-rose-200"),
        },
        { name: "visits", label: "Визитов", inForm: false },
        { name: "last_visit", label: "Последний визит", inForm: false, render: (r) => (r.last_visit ? formatDate(r.last_visit) : "—") },
        { name: "total_spent", label: "Потрачено", inForm: false, render: (r) => (r.total_spent ? formatPrice(r.total_spent) : "—") },
        { name: "bonus_balance", label: "Баллы", inForm: false, render: (r, act) => <BonusCell row={r} act={act} /> },
        { name: "master", label: "Карточка мастера", inForm: false, inTable: false },
        { name: "username", label: "Логин", inForm: false, inTable: false },
        { name: "note", label: "Внутренний комментарий", type: "textarea", render: (r) => r.note && <span className="text-rose-700">{r.note}</span> },
        { name: "is_blocked", label: "В чёрном списке (запрет онлайн-записи)", type: "checkbox", inTable: false },
        { name: "blocked_reason", label: "Причина блокировки (необязательно)", inTable: false },
      ]}
    />
  )
}

function PolicySection() {
  const policy = useApi(bookingApi.cancellationPolicy)
  return (
    <div>
      <h1 className="text-3xl font-serif text-foreground mb-2">Правила отмены</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Клиент сам отменяет или переносит запись в личном кабинете не позднее чем за указанное время до начала. Позже —
        только через салон: сотрудники меняют статус записей в разделе «Записи» без ограничений.
      </p>
      {policy.data ? <PolicyForm initial={policy.data.deadline_hours} /> : <Loader q={policy} />}
    </div>
  )
}

function PolicyForm({ initial }: { initial: number }) {
  const [hours, setHours] = useState(String(initial))
  const [saved, setSaved] = useState(String(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      setSaved(String((await adminApi.setCancellationPolicy({ deadline_hours: Number(hours) })).deadline_hours))
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-3xl border border-rose-100 p-6 max-w-md space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="deadline-hours" className="text-sm font-medium text-foreground">
          Отмена и перенос не позднее чем за, часов
        </label>
        <input id="deadline-hours" type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} className={INPUT} />
        <p className="text-xs text-muted-foreground">0 — можно отменить в любой момент до начала визита.</p>
      </div>
      {error && <ErrorMessage error={error} />}
      <button
        type="submit"
        disabled={saving || hours === "" || hours === saved}
        className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Сохранение…" : hours === saved ? "Сохранено" : "Сохранить"}
      </button>
    </form>
  )
}

/** Фото услуги: клик — загрузить и обрезать / удалить */
function ServiceImageCell({ row, act }: { row: Row; act: RowActions }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Изменить фото"
        aria-label={`Фото: ${row.name}`}
        className="relative group rounded-xl overflow-hidden size-16 shrink-0 border border-rose-100"
      >
        {row.image ? (
          <img src={row.image} alt={row.name} className="size-full object-cover" />
        ) : (
          <span className="size-full flex items-center justify-center bg-rose-50 text-rose-300">
            <Camera className="size-6" />
          </span>
        )}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera className="size-4 text-white" />
        </span>
      </button>
      {open && (
        <AvatarCropper
          title={`Фото: ${row.name}`}
          hasPhoto={Boolean(row.image)}
          onSave={(blob) => catalogApi.uploadServiceImage(row.id, blob).then(act.reload)}
          onDelete={() => catalogApi.deleteServiceImage(row.id).then(act.reload)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function ServicesSection() {
  const [deleted, setDeleted] = useState(false)
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setDeleted(false)} aria-pressed={!deleted} className={chipCls(!deleted)}>
          Действующие
        </button>
        <button onClick={() => setDeleted(true)} aria-pressed={deleted} className={chipCls(deleted)}>
          Удалённые
        </button>
      </div>
      {deleted ? (
        <CrudTable
          key="deleted"
          title="Удалённые услуги"
          endpoint="/services/"
          query="?deleted=1"
          canCreate={false}
          canEdit={false}
          canDelete={false}
          fields={[
            { name: "name", label: "Название" },
            { name: "category", label: "Категория" },
            { name: "price", label: "Цена", render: (r) => formatPrice(r.price) },
            { name: "deleted_at", label: "Удалена", render: (r) => formatDate(r.deleted_at.slice(0, 10)) },
            { name: "future_bookings", label: "Будущих записей" },
            {
              name: "restore",
              label: "",
              inForm: false,
              render: (r, act) => (
                <button
                  onClick={() => act.run(() => adminApi.restoreService(r.id))}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-gold text-gold-dark text-xs font-medium hover:bg-gold/10 transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="size-3.5" /> Восстановить
                </button>
              ),
            },
          ]}
        />
      ) : (
        <CrudTable
          key="active"
          title="Услуги"
          endpoint="/services/"
          deleteConfirm={(r) =>
            r.future_bookings
              ? `У услуги «${r.name}» есть будущие записи: ${r.future_bookings}. Они останутся, но новых записей не будет. Удалить? Восстановить можно в «Удалённых».`
              : `Удалить услугу «${r.name}»? Восстановить можно в «Удалённых».`
          }
          rowClass={(r) => (r.is_active ? "" : "opacity-50")}
          fields={[
            { name: "image", label: "Фото", inForm: false, render: (r, act) => <ServiceImageCell row={r} act={act} /> },
            { name: "name", label: "Название" },
            { name: "category", label: "Категория" },
            {
              name: "price",
              label: "Цена",
              type: "number",
              render: (r) => <PriceTag base={r.price} price={r.price_today} discount={r.discount_percent} className="whitespace-nowrap" />,
            },
            { name: "duration_minutes", label: "Минут", type: "number" },
            { name: "description", label: "Описание", type: "textarea", inTable: false },
            { name: "is_active", label: "Активна (снять — временно скрыть)", type: "checkbox", default: true },
          ]}
        />
      )}
    </div>
  )
}

const REVIEW_STATUS: Option[] = [
  { value: "new", label: "На модерации" },
  { value: "published", label: "Опубликован" },
  { value: "rejected", label: "Не опубликован" },
]

/** Статус отзыва + быстрые кнопки «Опубликовать» / «Отклонить» */
function ModerationCell({ row, act }: { row: Row; act: RowActions }) {
  const setStatus = (status: string) =>
    act.patch({ status }).then(() => window.dispatchEvent(new Event(COUNTERS_CHANGED)))
  const cls =
    row.status === "published"
      ? "bg-green-50 text-green-700 border-green-200"
      : row.status === "rejected"
        ? "bg-rose-50 text-muted-foreground border-rose-200"
        : "bg-yellow-100 text-yellow-800 border-yellow-300"
  return (
    <div className="flex flex-col items-start gap-2">
      {badge(REVIEW_STATUS.find((s) => s.value === row.status)!.label, cls)}
      <div className="flex flex-col items-start gap-1.5">
        {row.status !== "published" && (
          <button onClick={() => setStatus("published")} className="px-3 py-1 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-medium whitespace-nowrap">
            Опубликовать
          </button>
        )}
        {row.status !== "rejected" && (
          <button onClick={() => setStatus("rejected")} className="px-3 py-1 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium whitespace-nowrap">
            Отклонить
          </button>
        )}
      </div>
    </div>
  )
}

/** Фото к отзыву: открыть крупно или удалить неуместное (текст отзыва остаётся) */
function ReviewPhotosCell({ row, act }: { row: Row; act: RowActions }) {
  const [opened, setOpened] = useState<string | null>(null)
  const photos: ReviewPhoto[] = row.photos
  if (!photos.length) return <>—</>
  const remove = (photo: ReviewPhoto) => {
    if (!confirm("Удалить это фото? Вернуть его будет нельзя.")) return
    act.run(() => adminApi.deleteReviewPhoto(row.id, photo.id))
  }
  return (
    <div className="flex gap-2">
      {photos.map((p) => (
        <div key={p.id} className="relative size-14">
          <button onClick={() => setOpened(p.url)} aria-label="Открыть фото" className="size-full rounded-lg overflow-hidden border border-rose-100 cursor-zoom-in">
            <img src={p.url} alt="" className="size-full object-cover" />
          </button>
          <button
            onClick={() => remove(p)}
            title="Удалить фото"
            aria-label="Удалить фото"
            className="absolute -top-2 -right-2 p-1 rounded-full bg-white border border-rose-200 text-muted-foreground hover:text-rose-600 shadow-sm"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
      {opened && <PhotoLightbox src={opened} onClose={() => setOpened(null)} />}
    </div>
  )
}

function ReviewsSection() {
  const handleExport = async () => {
    try {
      const token = tokens.access;
      
      const response = await fetch('/api/admin/reviews/export/', {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      
      if (!response.ok) {
        console.error(`Ошибка сервера: ${response.status} ${response.statusText}`);
        throw new Error('Ошибка при скачивании');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Отзывы_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Детали ошибки экспорта:", error);
      alert("Не удалось скачать файл.");
    }
  };

  return (
    <CrudTable
      title="Отзывы"
      endpoint="/admin/reviews/"
      canCreate={false}
      canDelete={false}
      defaultFilter={0}
      onExport={handleExport}
      filters={[
        { label: "Новые", test: (r) => r.status === "new" },
        { label: "Опубликованные", test: (r) => r.status === "published" },
        { label: "Отклонённые", test: (r) => r.status === "rejected" },
      ]}
      fields={[
        { name: "created_at", label: "Дата", inForm: false, render: (r) => formatDate(r.created_at.slice(0, 10)) },
        {
          name: "client_name",
          label: "Клиент",
          inForm: false,
          render: (r) => (
            <div className="min-w-32">
              <p className="font-medium">{r.client_name}</p>
              <p className="text-xs text-muted-foreground">на сайте: {r.author}</p>
            </div>
          ),
        },
        { name: "rating", label: "Оценка", inForm: false, render: (r) => <StarRating value={r.rating} /> },
        {
          name: "employee_name",
          label: "Мастер",
          inForm: false,
          render: (r) => (
            <div>
              {r.employee_name}
              <p className="text-xs text-muted-foreground">{r.service_name}</p>
            </div>
          ),
        },
        { name: "text", label: "Текст", inForm: false, render: (r) => <p className="min-w-48 max-w-xs whitespace-pre-line">{r.text}</p> },
        { name: "photos", label: "Фото", inForm: false, render: (r, act) => <ReviewPhotosCell row={r} act={act} /> },
        { name: "status", label: "Статус", type: "select", options: REVIEW_STATUS, render: (r, act) => <ModerationCell row={r} act={act} /> },
        {
          name: "reply",
          label: "Ответ салона (виден под отзывом)",
          type: "textarea",
          render: (r) => (r.reply ? <p className="min-w-48 text-sm text-muted-foreground whitespace-pre-line">{r.reply}</p> : "—"),
        },
      ]}
    />
  )
}

function ClosuresSection() {
  const today = toIsoDate(new Date())
  const checkConflicts = async (v: Record<string, Value>) => {
    if (!v.date_from || !v.date_to) return true
    const conflicts = await adminApi.closureConflicts({
      date_from: String(v.date_from),
      date_to: String(v.date_to),
      open_time: v.open_time ? String(v.open_time) : null,
      close_time: v.close_time ? String(v.close_time) : null,
    })
    if (!conflicts.length) return true
    const list = conflicts.slice(0, 15).join("\n") + (conflicts.length > 15 ? `\n…и ещё ${conflicts.length - 15}` : "")
    return confirm(
      `На эти дни есть записи (${conflicts.length}):\n\n${list}\n\n` +
        "Они не отменятся сами — решите, что с ними делать, в разделе «Записи». Сохранить?",
    )
  }
  return (
    <div>
      <p className="text-muted-foreground mb-6 max-w-2xl">
        Часы не заданы — салон закрыт весь день. Заданы — сокращённый день. Клиенты видят название в календаре записи,
        а за 7 дней — баннер на главной. Бот и сайт сами перестают предлагать это время.
      </p>
      <CrudTable
        title="Праздники и выходные"
        endpoint="/admin/closures/"
        beforeSubmit={checkConflicts}
        rowClass={(r) => (r.date_to < today ? "opacity-50" : "")}
        fields={[
          { name: "name", label: "Название (видят клиенты)" },
          { name: "date_from", label: "С", type: "date", render: (r) => formatDate(r.date_from) },
          { name: "date_to", label: "По", type: "date", render: (r) => formatDate(r.date_to) },
          {
            name: "open_time",
            label: "Открыто с",
            type: "time",
            render: (r) =>
              r.open_time
                ? `${formatTime(r.open_time)}–${formatTime(r.close_time)}`
                : badge("закрыто", "bg-red-50 text-red-700 border-red-200"),
          },
          { name: "close_time", label: "Открыто до", type: "time", inTable: false },
          {
            name: "conflicts",
            label: "Записи на эти дни",
            inForm: false,
            render: (r) =>
              r.conflicts.length ? (
                <details>
                  <summary className="cursor-pointer text-yellow-800 whitespace-nowrap">⚠ {r.conflicts.length} зап.</summary>
                  <ul className="mt-2 text-xs space-y-1 min-w-64">
                    {r.conflicts.map((c: string) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
        ]}
      />
    </div>
  )
}

function PromotionsAdminSection() {
  const services = useApi(catalogApi.services)
  if (!services.data) return <Loader q={services} />
  const today = toIsoDate(new Date())
  return (
    <CrudTable
      title="Акции"
      endpoint="/admin/promotions/"
      rowClass={(r) => (!r.is_active || r.date_to < today ? "opacity-50" : "")}
      fields={[
        { name: "name", label: "Название" },
        {
          name: "discount_percent",
          label: "Скидка, %",
          type: "number",
          render: (r) => badge(`−${r.discount_percent}%`, "bg-rose-600 text-white border-rose-600"),
        },
        {
          name: "services",
          label: "Услуги (ничего не выбрано — на все)",
          type: "multiselect",
          options: services.data.map((s) => ({ value: s.id, label: s.name })),
          render: (r) =>
            r.services.length
              ? services.data!.filter((s) => r.services.includes(s.id)).map((s) => s.name).join(", ")
              : "Все услуги",
        },
        { name: "date_from", label: "С", type: "date", default: today, render: (r) => formatDate(r.date_from) },
        { name: "date_to", label: "По", type: "date", render: (r) => formatDate(r.date_to) },
        { name: "description", label: "Описание", type: "textarea", inTable: false },
        { name: "is_active", label: "Активна", type: "checkbox", default: true },
      ]}
    />
  )
}

function useCounters(enabled: boolean) {
  const [counters, setCounters] = useState<PanelCounters | null>(null)
  useEffect(() => {
    if (!enabled) return
    const load = () =>
      adminApi
        .counters()
        .then(setCounters)
        .catch(() => {})
    load()
    const timer = setInterval(load, 60_000)
    window.addEventListener(COUNTERS_CHANGED, load)
    return () => {
      clearInterval(timer)
      window.removeEventListener(COUNTERS_CHANGED, load)
    }
  }, [enabled])
  return counters
}

/** Фото карточки мастера: клик — загрузить и обрезать / удалить */
function MasterPhotoCell({ row, act }: { row: Row; act: RowActions }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} title="Изменить фото" aria-label={`Фото: ${row.full_name}`} className="relative group rounded-full">
        <Avatar src={masterPhoto(row as Employee)} name={row.full_name} className="size-12 text-sm" />
        <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera className="size-4 text-white" />
        </span>
      </button>
      {open && (
        <AvatarCropper
          title={`Фото: ${row.full_name}`}
          hasPhoto={Boolean(row.photo)}
          onSave={(blob) => catalogApi.uploadMasterPhoto(row.id, blob).then(act.reload)}
          onDelete={() => catalogApi.deleteMasterPhoto(row.id).then(act.reload)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function MastersSection() {
  const services = useApi(catalogApi.services)
  const users = useApi(adminApi.users)
  if (!services.data || !users.data) return <Loader q={services.error ? services : users} />

  const accounts: Option[] = [
    { value: null, label: "— не привязан" },
    ...users.data.filter((u) => u.is_staff).map((u) => ({ value: u.id, label: u.username })),
  ]
  return (
    <CrudTable
      title="Мастера"
      endpoint="/employees/"
      canDelete={false}
      rowClass={(r) => (r.is_active ? "" : "opacity-50")}
      fields={[
        { name: "photo", label: "Фото", inForm: false, render: (r, act) => <MasterPhotoCell row={r} act={act} /> },
        { name: "full_name", label: "ФИО" },
        { name: "specialization", label: "Специализация" },
        { name: "phone", label: "Телефон" },
        { name: "services", label: "Услуги", type: "multiselect", options: services.data.map((s) => ({ value: s.id, label: s.name })) },
        { name: "user", label: "Аккаунт сотрудника (для «Моего кабинета»)", type: "select", options: accounts },
        { name: "is_active", label: "Работает", type: "checkbox", default: true },
      ]}
    />
  )
}

function ScheduleSection() {
  const { masters, options } = useMasterOptions()
  if (!options) return <Loader q={masters} />
  return (
    <CrudTable
      title="График мастеров"
      endpoint="/admin/schedules/"
      fields={[
        { name: "employee", label: "Мастер", type: "select", options },
        { name: "day_of_week", label: "День недели", type: "select", options: DAYS },
        { name: "start_time", label: "Начало", type: "time", default: "10:00" },
        { name: "end_time", label: "Конец", type: "time", default: "20:00" },
      ]}
    />
  )
}

function TimeOffSection() {
  const { masters, options } = useMasterOptions()
  if (!options) return <Loader q={masters} />
  return (
    <CrudTable
      title="Блокировки времени"
      endpoint="/admin/time-offs/"
      fields={[
        { name: "employee", label: "Мастер", type: "select", options },
        { name: "date", label: "Дата", type: "date", render: (r) => formatDate(r.date) },
        { name: "start_time", label: "С", type: "time" },
        { name: "end_time", label: "До", type: "time" },
        { name: "reason", label: "Причина" },
      ]}
    />
  )
}

function StockSection() {
  const isLow = (r: Row) => r.quantity <= r.min_quantity
  return (
    <CrudTable
      title="Склад"
      endpoint="/finance/stock/"
      rowClass={(r) => (isLow(r) ? "bg-rose-50/60" : "")}
      fields={[
        { name: "name", label: "Название" },
        {
          name: "category",
          label: "Категория",
          type: "select",
          options: [
            { value: "cosmetics", label: "Косметика" },
            { value: "consumables", label: "Расходные материалы" },
          ],
        },
        {
          name: "quantity",
          label: "Остаток",
          type: "number",
          render: (r) => (
            <span className="whitespace-nowrap">
              {r.quantity} {r.unit} {isLow(r) && badge("заканчивается", "ml-2 bg-rose-50 text-rose-600 border-rose-200")}
            </span>
          ),
        },
        { name: "unit", label: "Ед. изм.", default: "шт", inTable: false },
        { name: "min_quantity", label: "Минимум", type: "number", default: 0 },
      ]}
    />
  )
}

function ExpensesSection() {
  return (
    <CrudTable
      title="Расходы"
      endpoint="/finance/expenses/"
      fields={[
        { name: "date", label: "Дата", type: "date", default: toIsoDate(new Date()), render: (r) => formatDate(r.date) },
        { name: "category", label: "Категория" },
        { name: "amount", label: "Сумма", type: "number", render: (r) => formatPrice(r.amount) },
        { name: "description", label: "Описание", type: "textarea" },
      ]}
    />
  )
}

const SECTIONS = [
  { path: "", label: "Записи", icon: Calendar, Component: BookingsSection },
  { path: "load", label: "Загрузка", icon: LayoutGrid, Component: LoadSection },
  { path: "cabinet", label: "Мой кабинет", icon: User, Component: EmployeePage },
  { path: "clients", label: "Клиенты", icon: Users, Component: ClientsSection },
  { path: "reviews", label: "Отзывы", icon: MessageSquareText, Component: ReviewsSection },
  { path: "services", label: "Услуги", icon: Scissors, Component: ServicesSection },
  { path: "masters", label: "Мастера", icon: UserCog, Component: MastersSection },
  { path: "schedule", label: "График мастеров", icon: CalendarClock, Component: ScheduleSection },
  { path: "time-off", label: "Блокировки", icon: Ban, Component: TimeOffSection },
  { path: "closures", label: "Праздники и выходные", icon: CalendarOff, Component: ClosuresSection },
  { path: "promotions", label: "Акции", icon: BadgePercent, Component: PromotionsAdminSection },
  { path: "cancellation", label: "Правила отмены", icon: CalendarX2, Component: PolicySection },
  { path: "stock", label: "Склад", icon: Package, Component: StockSection },
  { path: "expenses", label: "Расходы", icon: Receipt, Component: ExpensesSection },
  { path: "dashboard", label: "Дашборд", icon: ChartColumn, Component: DashboardPage },
  { path: "finance", label: "Финансы", icon: Wallet, Component: FinancePage },
]

export const panelRoutes = SECTIONS.map(({ path, Component }) =>
  path ? { path, Component } : { index: true, Component },
)

export function PanelLayout() {
  const { user, loading } = useAuth()
  const counters = useCounters(Boolean(user?.is_staff))
  const badges: Record<string, { count?: number; title: string }> = {
    "": { count: counters?.pending_bookings, title: "ждут подтверждения" },
    reviews: { count: counters?.new_reviews, title: "новых отзывов" },
  }

  if (!user?.is_staff) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-muted-foreground">
        {loading ? "Загрузка…" : "Доступно только сотрудникам."}
      </div>
    )
  }

  return (
    <div className="flex-1 bg-pearl pb-24">
      <div className="max-w-7xl mx-auto px-6 pt-10 flex flex-col md:flex-row gap-8">
        <aside className="md:w-60 shrink-0">
          <p className="hidden md:block px-4 mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Панель управления
          </p>
          {counters && (
            <NavLink to="/panel" end className="block mb-3 px-4 py-2 rounded-2xl bg-white border border-rose-100 text-sm text-muted-foreground hover:border-gold transition-colors">
              Сегодня: <span className="font-semibold text-foreground">{plural(counters.today_bookings, ["запись", "записи", "записей"])}</span>
            </NavLink>
          )}
          <nav className="md:sticky md:top-28 bg-white rounded-3xl border border-rose-100 p-2 flex md:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={`/panel/${path}`}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-rose-50 text-gold" : "text-muted-foreground hover:bg-rose-50/50 hover:text-foreground"
                  }`
                }
              >
                <Icon className="size-4 shrink-0" /> {label}
                {!!badges[path]?.count && (
                  <span
                    title={badges[path].title}
                    aria-label={`${badges[path].title}: ${badges[path].count}`}
                    className="ml-auto min-w-6 px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-950 text-xs font-semibold text-center"
                  >
                    {badges[path].count}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}