import { adminApi, reportsApi, type Booking } from "@/api/api"
import { useApi } from "@/api/useApi"
import { ErrorMessage } from "../components/ErrorMessage"
import { BOOKING_STATUS } from "../components/StatusBadge"
import { formatDate, formatPrice } from "@/lib/format"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

const TODAY_STATUSES: Booking["status"][] = ["pending", "confirmed", "completed", "cancelled"]

/** Карточки «Сегодня»: всего записей, по статусам и ожидаемая выручка */
function TodayTiles() {
  const today = useApi(adminApi.todayStats)
  if (today.error) return <ErrorMessage error={today.error} onRetry={today.reload} />
  if (!today.data) return <p className="text-muted-foreground mb-10">Загрузка…</p>
  const tile = "bg-white rounded-3xl border border-rose-100 p-5"
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-serif text-foreground mb-4">Сегодня, {formatDate(today.data.date)}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`${tile} border-gold/40`}>
          <p className="text-sm text-muted-foreground mb-1">Записей на сегодня</p>
          <p className="text-3xl font-serif text-foreground">{today.data.total}</p>
        </div>
        <div className={tile}>
          <p className="text-sm text-muted-foreground mb-1">Ожидаемая выручка</p>
          <p className="text-3xl font-serif text-foreground">{formatPrice(today.data.expected_revenue)}</p>
        </div>
        {TODAY_STATUSES.map((status) => {
          const { label, icon: Icon } = BOOKING_STATUS[status]
          return (
            <div key={status} className={tile}>
              <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
                <Icon className="size-4" /> {label}
              </p>
              <p className="text-2xl font-serif text-foreground">{today.data!.by_status[status]}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { data, loading, error, reload } = useApi(reportsApi.popularServices)

  return (
    <div>
      <TodayTiles />
      <h1 className="text-3xl font-serif text-foreground mb-8">Популярные услуги</h1>

      {loading && <p className="text-muted-foreground">Загрузка…</p>}
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {!loading && !error && data?.length === 0 && (
        <p className="text-muted-foreground">Записей пока нет.</p>
      )}

      {!!data?.length && (
        <>
          <div className="bg-white rounded-3xl border border-rose-100 p-6 mb-8" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service_name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings_count" fill="#c9a24b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-3xl border border-rose-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-rose-50 text-muted-foreground text-left">
                <tr>
                  <th className="p-4">Услуга</th>
                  <th className="p-4">Записей</th>
                  <th className="p-4">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.service_id} className="border-t border-rose-50">
                    <td className="p-4">{row.service_name}</td>
                    <td className="p-4">{row.bookings_count}</td>
                    <td className="p-4">{formatPrice(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}