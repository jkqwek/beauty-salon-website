// pages/FinancePage.tsx
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

const tableWrap = "bg-white rounded-3xl border border-rose-100 overflow-x-auto"

/** Таблица «название — отмен — потеряно» для разбивки по услугам и по мастерам */
function LostTable({
  title,
  rows,
}: {
  title: string
  rows: { key: number; name: string; count: number; lost: string }[]
}) {
  return (
    <div>
      <h3 className="text-lg font-serif text-foreground mb-3">{title}</h3>
      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className="bg-rose-50 text-muted-foreground text-left">
            <tr>
              <th className="p-4">Название</th>
              <th className="p-4">Отмен</th>
              <th className="p-4">Потеряно</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-rose-50">
                <td className="p-4">{row.name}</td>
                <td className="p-4">{row.count}</td>
                <td className="p-4">{formatPrice(row.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function FinancePage() {
  const revenue = useApi(() => financeApi.revenueReport({ group_by: "month" }), [])
  const workload = useApi(() => financeApi.employeeWorkload(), [])
  const income = useApi(() => financeApi.incomeSummary(), [])
  const expenses = useApi(() => financeApi.expenses(), [])
  const popular = useApi(() => financeApi.popularServices(), [])
  const cancelled = useApi(() => financeApi.cancellations(), [])

  const loading =
    revenue.loading || workload.loading || income.loading || expenses.loading || popular.loading || cancelled.loading
  const error =
    revenue.error || workload.error || income.error || expenses.error || popular.error || cancelled.error

  return (
    <div>
      <h1 className="text-3xl font-serif text-foreground mb-8">Финансы</h1>

      {loading && <p className="text-muted-foreground">Загрузка…</p>}
      {error && <ErrorMessage error={error} onRetry={() => {
        revenue.reload(); workload.reload(); income.reload(); expenses.reload(); popular.reload(); cancelled.reload()
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

          {/* какие услуги приносят больше денег */}
          {popular.data && (
            <>
              <h2 className="text-xl font-serif text-foreground mb-4">Какие услуги приносят больше денег</h2>
              {popular.data.results.length === 0 ? (
                <p className="text-muted-foreground mb-8">Выполненных записей пока нет.</p>
              ) : (
                <div className={`${tableWrap} mb-8`}>
                  <table className="w-full text-sm">
                    <thead className="bg-rose-50 text-muted-foreground text-left">
                      <tr>
                        <th className="p-4">Услуга</th>
                        <th className="p-4">Записей</th>
                        <th className="p-4">Выручка</th>
                        <th className="p-4">Средний чек</th>
                        <th className="p-4">Доля выручки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popular.data.results.map((row) => (
                        <tr key={row.service_id} className="border-t border-rose-50">
                          <td className="p-4">{row.service_name}</td>
                          <td className="p-4">{row.bookings_count}</td>
                          <td className="p-4 whitespace-nowrap">{formatPrice(row.revenue)}</td>
                          <td className="p-4 whitespace-nowrap">{formatPrice(row.avg_check)}</td>
                          <td className="p-4 min-w-44">
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 rounded-full bg-rose-100 overflow-hidden" aria-hidden="true">
                                <div className="h-full bg-gold" style={{ width: `${row.share_percent}%` }} />
                              </div>
                              <span className="w-14 text-right tabular-nums">{row.share_percent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
                      <th className="p-4">Часов (план)</th>
                      <th className="p-4">Часов (факт)</th>
                      <th className="p-4">Выручка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.data.map((row) => (
                      <tr key={row.employee_id} className="border-t border-rose-50">
                        <td className="p-4">{row.employee_name}</td>
                        <td className="p-4">{row.bookings_count}</td>
                        <td className="p-4">{row.total_hours}</td>
                        <td className="p-4">{row.actual_hours}</td>
                        <td className="p-4">{formatPrice(row.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* отменённые записи и потерянная выручка */}
          {cancelled.data && (
            <>
              <h2 className="text-xl font-serif text-foreground mb-4">Отменённые записи</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-3xl border border-rose-100 p-6">
                  <p className="text-sm text-muted-foreground mb-1">Отменено записей</p>
                  <p className="text-2xl font-serif text-foreground">{cancelled.data.cancelled_count}</p>
                </div>
                <div className="bg-white rounded-3xl border border-rose-100 p-6">
                  <p className="text-sm text-muted-foreground mb-1">Доля отмен</p>
                  <p className="text-2xl font-serif text-foreground">{cancelled.data.cancel_rate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">от {cancelled.data.bookings_total} записей</p>
                </div>
                <div className="bg-white rounded-3xl border border-rose-100 p-6">
                  <p className="text-sm text-muted-foreground mb-1">Потенциально потеряно</p>
                  <p className="text-2xl font-serif text-foreground">{formatPrice(cancelled.data.lost_revenue)}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Считается по дате визита. Это потенциальная выручка: освободившееся время мог занять другой клиент.
              </p>

              {cancelled.data.cancelled_count === 0 ? (
                <p className="text-muted-foreground mb-8">Отмен пока нет.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <LostTable
                    title="По услугам"
                    rows={cancelled.data.by_service.map((r) => ({
                      key: r.service_id, name: r.service_name, count: r.cancelled_count, lost: r.lost_revenue,
                    }))}
                  />
                  <LostTable
                    title="По мастерам"
                    rows={cancelled.data.by_employee.map((r) => ({
                      key: r.employee_id, name: r.employee_name, count: r.cancelled_count, lost: r.lost_revenue,
                    }))}
                  />
                </div>
              )}
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