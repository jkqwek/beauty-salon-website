// pages/FinancePage.tsx
import { useState } from "react"
import { Download } from "lucide-react"
import { financeApi } from "@/api/api"
import { toApiError, type ApiError } from "@/api/client"
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
const dateInput =
  "rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"

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
  // период: одни и те же даты идут во все отчёты и в выгрузку, поэтому экран и файл совпадают
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const badRange = Boolean(from && to && to < from)
  const params = badRange ? {} : { date_from: from || undefined, date_to: to || undefined }

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<ApiError | null>(null)

  const revenue = useApi(() => financeApi.revenueReport({ ...params, group_by: "month" }), [from, to])
  const workload = useApi(() => financeApi.employeeWorkload(params), [from, to])
  const income = useApi(() => financeApi.incomeSummary(params), [from, to])
  const expenses = useApi(() => financeApi.expenses(), [])
  const popular = useApi(() => financeApi.popularServices(params), [from, to])
  const cancelled = useApi(() => financeApi.cancellations(params), [from, to])

  const loading =
    revenue.loading || workload.loading || income.loading || expenses.loading || popular.loading || cancelled.loading
  const error =
    revenue.error || workload.error || income.error || expenses.error || popular.error || cancelled.error

  // расходы с сервера приходят списком целиком, период применяем здесь (даты ISO сравниваются как строки)
  const shownExpenses = (expenses.data ?? []).filter(
    (e) => (!from || e.date >= from) && (!to || e.date <= to),
  )

  const exportExcel = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await financeApi.exportExcel(params)
    } catch (e) {
      setExportError(toApiError(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-serif text-foreground mb-8">Финансы</h1>

      {/* период и выгрузка стоят вне блока загрузки, чтобы не пропадать при смене дат */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          С даты
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          По дату
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateInput} />
        </label>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("")
              setTo("")
            }}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-gold-dark transition-colors"
          >
            Сбросить период
          </button>
        )}
        <button
          onClick={exportExcel}
          disabled={exporting || badRange}
          className="sm:ml-auto inline-flex items-center gap-2 border-2 border-gold text-gold-dark hover:bg-gold hover:text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="size-4" />
          {exporting ? "Формируем…" : "Скачать Excel"}
        </button>
      </div>
      {badRange && <p className="text-sm text-rose-600 mb-4">Дата «по» не может быть раньше даты «с».</p>}
      {exportError && (
        <div className="mb-4">
          <ErrorMessage error={exportError} />
        </div>
      )}
      <div className="mb-4" />

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
              <div className={`${tableWrap} mb-8`}>
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
          {shownExpenses.length === 0 && (
            <p className="text-muted-foreground">Расходов за выбранный период нет.</p>
          )}
          {!!shownExpenses.length && (
            <div className={tableWrap}>
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
                  {shownExpenses.map((exp) => (
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