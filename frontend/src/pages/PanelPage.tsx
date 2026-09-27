import { useState, type FormEvent } from "react"
import { NavLink, Outlet } from "react-router"
import {
  Ban,
  Calendar,
  CalendarClock,
  CalendarX2,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Package,
  Receipt,
  Scissors,
  User,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { adminApi, bookingApi, catalogApi, type Booking, type SalonLoad } from "@/api/api"
import { toApiError, type ApiError } from "@/api/client"
import { useApi } from "@/api/useApi"
import { formatDate, formatPrice, formatTime, shiftDate, toIsoDate } from "@/lib/format"
import { CrudTable, INPUT, downloadCsv, exportButton, type Option, type Row } from "../components/CrudTable"
import { ErrorMessage } from "../components/ErrorMessage"
import { EmployeePage } from "./EmployeePage"
import { DashboardPage } from "./DashboardPage"
import { FinancePage } from "./FinancePage"

const DAYS: Option[] = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"].map(
  (label, value) => ({ value, label }),
)

const STATUS: Record<Booking["status"], { label: string; cls: string }> = {
  active: { label: "Активна", cls: "bg-gold/10 text-gold border-gold/30" },
  completed: { label: "Завершена", cls: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Отменена", cls: "bg-rose-50 text-rose-600 border-rose-200" },
}

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

function BookingsSection() {
  const [day, setDay] = useState(() => toIsoDate(new Date()))
  const [master, setMaster] = useState("")
  const { data, error, reload } = useApi(() => adminApi.bookings(day), [day])
  const [actionError, setActionError] = useState<ApiError | null>(null)

  const setStatus = async (id: number, status: Booking["status"]) => {
    setActionError(null)
    try {
      await adminApi.setBookingStatus(id, status)
      reload()
    } catch (e) {
      setActionError(toApiError(e))
    }
  }

  const masters = [...new Set(data?.map((b) => b.employee_name))]
  const rows = data?.filter((b) => !master || b.employee_name === master) ?? []
  const revenue = rows.filter((b) => b.status !== "cancelled").reduce((sum, b) => sum + Number(b.price ?? 0), 0)

  const exportCsv = () =>
    downloadCsv(`Записи ${day}.csv`, [
      ["Дата", "Начало", "Конец", "Клиент", "Услуга", "Мастер", "Цена", "Статус"],
      ...rows.map((b) => [
        day,
        formatTime(b.start_time),
        formatTime(b.end_time),
        b.client_name,
        b.service_name,
        b.employee_name,
        b.price ?? "",
        STATUS[b.status].label,
      ]),
    ])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-serif text-foreground">Записи</h1>
        <DayNav day={day} onChange={setDay} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <p className="text-muted-foreground mr-auto">
          {formatDate(day)} · {rows.length} зап. · {formatPrice(String(revenue))}
        </p>
        {masters.length > 1 && (
          <select
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            className="px-4 py-2 rounded-full border border-rose-200 bg-white text-sm focus:outline-none focus:border-gold"
          >
            <option value="">Все мастера</option>
            {masters.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}
        {exportButton(exportCsv, rows.length === 0)}
      </div>

      {!data && <Loader q={{ error, reload }} />}
      {actionError && <ErrorMessage error={actionError} />}
      {data && rows.length === 0 && <p className="text-muted-foreground">На этот день записей нет.</p>}

      {rows.length > 0 && (
        <div className="bg-white rounded-3xl border border-rose-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rose-50 text-muted-foreground text-left">
              <tr>
                {["Время", "Клиент", "Услуга", "Мастер", "Цена", "Статус"].map((h) => (
                  <th key={h} className="p-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-rose-50 hover:bg-rose-50/40 transition-colors">
                  <td className="p-4 whitespace-nowrap font-medium">
                    {formatTime(b.start_time)}–{formatTime(b.end_time)}
                  </td>
                  <td className="p-4">{b.client_name}</td>
                  <td className="p-4">{b.service_name}</td>
                  <td className="p-4">{b.employee_name}</td>
                  <td className="p-4 whitespace-nowrap">{b.price ? formatPrice(b.price) : "—"}</td>
                  <td className="p-4">
                    <select
                      value={b.status}
                      onChange={(e) => setStatus(b.id, e.target.value as Booking["status"])}
                      aria-label="Статус записи"
                      className={`px-3 py-1 rounded-full border text-xs font-medium focus:outline-none ${STATUS[b.status].cls}`}
                    >
                      {Object.entries(STATUS).map(([value, s]) => (
                        <option key={value} value={value}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
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
  return undefined // рабочее и свободное — белое
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

function ClientsSection() {
  const { user } = useAuth()
  return (
    <CrudTable
      title="Клиенты"
      endpoint="/admin/users/"
      canCreate={false}
      canDelete={false}
      fields={[
        {
          name: "first_name",
          label: "Имя",
          render: (r) => (
            <div>
              <p className="font-medium">
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.username}
                {r.id === user?.id && " (вы)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.username}
                {r.master && ` · мастер ${r.master}`}
              </p>
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
              ? badge("Сотрудник", "bg-gold/10 text-gold border-gold/30")
              : badge("Покупатель", "bg-rose-50 text-muted-foreground border-rose-200"),
        },
        { name: "visits", label: "Визитов", inForm: false },
        { name: "last_visit", label: "Последний визит", inForm: false, render: (r) => (r.last_visit ? formatDate(r.last_visit) : "—") },
        { name: "total_spent", label: "Потрачено", inForm: false, render: (r) => (r.total_spent ? formatPrice(r.total_spent) : "—") },
        { name: "master", label: "Карточка мастера", inForm: false, inTable: false },
        { name: "username", label: "Логин", inForm: false, inTable: false },
        { name: "note", label: "Внутренний комментарий", type: "textarea", render: (r) => r.note && <span className="text-rose-700">{r.note}</span> },
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

function ServicesSection() {
  return (
    <CrudTable
      title="Услуги"
      endpoint="/services/"
      canDelete={false} // удаление каскадом удалит записи — вместо этого снимаем "Активна"
      rowClass={(r) => (r.is_active ? "" : "opacity-50")}
      fields={[
        { name: "name", label: "Название" },
        { name: "category", label: "Категория" },
        { name: "price", label: "Цена", type: "number", render: (r) => formatPrice(r.price) },
        { name: "duration_minutes", label: "Минут", type: "number" },
        { name: "description", label: "Описание", type: "textarea", inTable: false },
        { name: "is_active", label: "Активна", type: "checkbox", default: true },
      ]}
    />
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
      canDelete={false} // удаление каскадом удалит записи — вместо этого снимаем "Работает"
      rowClass={(r) => (r.is_active ? "" : "opacity-50")}
      fields={[
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
      title="График работы"
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
  { path: "services", label: "Услуги", icon: Scissors, Component: ServicesSection },
  { path: "masters", label: "Мастера", icon: UserCog, Component: MastersSection },
  { path: "schedule", label: "График", icon: CalendarClock, Component: ScheduleSection },
  { path: "time-off", label: "Блокировки", icon: Ban, Component: TimeOffSection },
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
