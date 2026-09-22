import { useAuth } from "@/auth/AuthContext"
import { reportsApi } from "@/api/api"
import { useApi } from "@/api/useApi"
import { ErrorMessage } from "../components/ErrorMessage"
import { formatPrice } from "@/lib/format"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

export function DashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi(reportsApi.popularServices)

  if (!user?.is_staff) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-muted-foreground">
        Доступно только администраторам.
      </div>
    )
  }

  return (
    <div className="flex-1 bg-pearl pb-24 px-6 pt-12 max-w-5xl mx-auto w-full">
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