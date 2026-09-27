import { api } from "./client"

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  is_staff: boolean
}

export interface Service {
  id: number
  name: string
  description: string
  price: string // Django отдаёт Decimal строкой: "4500.00"
  duration_minutes: number
  category: string
  is_active: boolean
}

export interface Employee {
  id: number
  full_name: string
  specialization: string
  photo: string | null
  services: number[]
}

export interface Booking {
  id: number
  employee: number
  employee_name: string
  service: number
  service_name: string
  date: string // "2026-10-24"
  start_time: string // "10:00:00"
  end_time: string
  status: "active" | "cancelled" | "completed"
}

export interface RegisterData {
  username: string
  email: string
  password: string
  password2: string
}

export const authApi = {
  login: (username: string, password: string) =>
    api<{ access: string; refresh: string }>("/auth/login/", {
      method: "POST",
      body: { username, password },
      auth: false,
    }),
  register: (data: RegisterData) =>
    api<{ username: string; email: string }>("/auth/register/", {
      method: "POST",
      body: data,
      auth: false,
    }),
  me: () => api<User>("/auth/me/"),
}

export const catalogApi = {
  services: () => api<Service[]>("/services/"),
  employees: (serviceId?: number) =>
    api<Employee[]>(serviceId ? `/employees/?service=${serviceId}` : "/employees/"),
}

export const bookingApi = {
  slots: (p: { employeeId: number; serviceId: number; date: string }) =>
    api<{ slots: string[] }>(
      `/bookings/available-slots/?employee_id=${p.employeeId}&service_id=${p.serviceId}&date=${p.date}`,
    ),
  create: (data: { employee: number; service: number; date: string; start_time: string }) =>
    api<Booking>("/bookings/", { method: "POST", body: data }),
  my: () => api<Booking[]>("/bookings/my/"),
}

export interface PopularServiceRow {
  service_id: number
  service_name: string
  bookings_count: number
  revenue: string
}

export const reportsApi = {
  popularServices: () => api<PopularServiceRow[]>("/bookings/reports/popular-services/"),
}

export interface Expense {
  id: number
  category: string
  amount: string
  date: string
  description: string
  created_at: string
}

export interface RevenueReportRow {
  period: string
  revenue: string
  expenses: string
  profit: string
}

export interface EmployeeWorkloadRow {
  employee_id: number
  employee_name: string
  bookings_count: number
  total_hours: number
  total_revenue: string
}

export interface IncomeSummary {
  total_income: string
  bookings_count: number
}

interface DateRangeParams {
  date_from?: string
  date_to?: string
}

function toQueryString(params:object) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  const qs = new URLSearchParams(entries).toString()
  return qs ? `?${qs}` : ""
}

export const financeApi = {
  expenses: () => api<Expense[]>("/finance/expenses/"),
  createExpense: (data: Omit<Expense, "id" | "created_at">) =>
    api<Expense>("/finance/expenses/", { method: "POST", body: data }),
  updateExpense: (id: number, data: Partial<Omit<Expense, "id" | "created_at">>) =>
    api<Expense>(`/finance/expenses/${id}/`, { method: "PATCH", body: data }),
  deleteExpense: (id: number) =>
    api<void>(`/finance/expenses/${id}/`, { method: "DELETE" }),

  incomeSummary: (params: DateRangeParams = {}) =>
    api<IncomeSummary>(`/finance/imcome-summary/${toQueryString(params)}`),

  revenueReport: (params: DateRangeParams & { group_by?: "day" | "week" | "month" } = {}) =>
    api<RevenueReportRow[]>(`/finance/revenue-report/${toQueryString(params)}`),

  employeeWorkload: (params: DateRangeParams = {}) =>
    api<EmployeeWorkloadRow[]>(`/finance/employee-workload/${toQueryString(params)}`),
}