// pages/FinancePage.tsx
import { useAuth } from "@/auth/AuthContext"
import { financeApi } from "@/api/api"
import { useApi } from "@/api/useApi"
import { ErrorMessage } from "../components/ErrorMessage"
import { formatPrice } from "@/lib/format"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"

export function FinancePage() {
  const { user } = useAuth()

  const revenue = useApi(() => financeApi.revenueReport({ group_by: "month" }), [])
  const workload = useApi(() => financeApi.employeeWorkload(), [])
  const income = useApi(() => financeApi.incomeSummary(), [])
  const expenses = useApi(() => financeApi.expenses(), [])

  if (!user?.is_staff) {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-muted-foreground">
        Доступно только администраторам.
      </div>
    )
  }

  const loading = revenue.loading || workload.loading || income.loading || expenses.loading
  const error = revenue.error || workload.error || income.error || expenses.error

  return (
    <div className="flex-1 bg-pearl pb-24 px-6 pt-12 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-serif text-foreground mb-8">Финансы</h1>

      {loading && <p className="text-muted-foreground">Загрузка…</p>}
      {error && <ErrorMessage error={error} onRetry={() => {
        revenue.reload(); workload.reload(); income.reload(); expenses.reload()
      }} />}

      {!loading && !error && (
        <>
          {/* карточки с общим доходом */}
          {income.data && (
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white rounded-3xl border border-rose-100 p-6">
                <p className="text-sm text-muted-foreground mb-1">Общий доход</p>
                <p className="text-2xl font-serif text-foreground">{formatPrice(income.data.total_income)}</p>
              </div>
              <div className="bg-white rounded-3xl border border-rose-100 p-6">
                <p className="text-sm text-muted-foreground mb-1">Завершённых записей</p>
                <p className="text-2xl font-serif text-foreground">{income.data.bookings_count}</p>
              </div>
            </div>
          )}

          {/* график выручки по месяцам */}
          {!!revenue.data?.length && (
            <div className="bg-white rounded-3xl border border-rose-100 p-6 mb-8" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#c9a24b" name="Выручка" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" stroke="#b45f5f" name="Расходы" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#5f8f5f" name="Прибыль" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* таблица загрузки мастеров */}
          {!!workload.data?.length && (
            <>
              <h2 className="text-xl font-serif text-foreground mb-4">Загрузка мастеров</h2>
              <div className="bg-white rounded-3xl border border-rose-100 overflow-hidden mb-8">
                <table className="w-full text-sm">
                  <thead className="bg-rose-50 text-muted-foreground text-left">
                    <tr>
                      <th className="p-4">Мастер</th>
                      <th className="p-4">Записей</th>
                      <th className="p-4">Часов</th>
                      <th className="p-4">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.data.map((row) => (
                      <tr key={row.employee_id} className="border-t border-rose-50">
                        <td className="p-4">{row.employee_name}</td>
                        <td className="p-4">{row.bookings_count}</td>
                        <td className="p-4">{row.total_hours}</td>
                        <td className="p-4">{formatPrice(row.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* таблица расходов */}
          <h2 className="text-xl font-serif text-foreground mb-4">Расходы</h2>
          {expenses.data?.length === 0 && (
            <p className="text-muted-foreground">Расходов пока нет.</p>
          )}
          {!!expenses.data?.length && (
            <div className="bg-white rounded-3xl border border-rose-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-rose-50 text-muted-foreground text-left">
                  <tr>
                    <th className="p-4">Дата</th>
                    <th className="p-4">Категория</th>
                    <th className="p-4">Сумма</th>
                    <th className="p-4">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.data.map((exp) => (
                    <tr key={exp.id} className="border-t border-rose-50">
                      <td className="p-4">{exp.date}</td>
                      <td className="p-4">{exp.category}</td>
                      <td className="p-4">{formatPrice(exp.amount)}</td>
                      <td className="p-4">{exp.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}