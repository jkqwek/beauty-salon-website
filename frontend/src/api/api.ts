import { api } from "./client"

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  is_staff: boolean // сотрудник: полные права
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
  client: number
  actual_start: string | null // ISO datetime, тайм-трекинг
  actual_end: string | null
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
  cancel: (id: number) => api<Booking>(`/bookings/${id}/cancel/`, { method: "POST" }),
  cancellationPolicy: () => api<CancellationPolicy>("/bookings/cancellation-policy/"),
}

export interface CancellationPolicy {
  deadline_hours: number // отмена и перенос не позднее чем за N часов
}

export interface CabinetClient {
  id: number
  name: string
  visits: number
  phone: string
  note: string // внутренний комментарий, клиенту не виден
}

export interface EmployeeCabinet {
  employee: string
  today: string
  schedule: { day: string; start_time: string; end_time: string }[]
  bookings: Booking[]
  clients: CabinetClient[]
}

export const employeeApi = {
  cabinet: () => api<EmployeeCabinet>("/bookings/employee/"),
  trackTime: (bookingId: number) =>
    api<Booking>(`/bookings/${bookingId}/track-time/`, { method: "POST" }),
  saveNote: (clientId: number, note: string) =>
    api<AdminUser>(`/admin/users/${clientId}/`, { method: "PATCH", body: { note } }),
}

export interface AdminUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  is_staff: boolean
  date_joined: string
  visits: number // по завершённым записям
  last_visit: string | null
  total_spent: string | null
  note: string | null
  master: string | null // карточка мастера, к которой привязан аккаунт
}

export interface AdminBooking extends Booking {
  client_name: string
  price: string | null
}

export const adminApi = {
  users: () => api<AdminUser[]>("/admin/users/"),
  bookings: (date: string) => api<AdminBooking[]>(`/admin/bookings/?date=${date}`),
  setBookingStatus: (id: number, status: Booking["status"]) =>
    api<AdminBooking>(`/admin/bookings/${id}/`, { method: "PATCH", body: { status } }),
  load: (date: string) => api<SalonLoad>(`/admin/load/?date=${date}`),
  setCancellationPolicy: (data: CancellationPolicy) =>
    api<CancellationPolicy>("/bookings/cancellation-policy/", { method: "PATCH", body: data }),
}

/** Карта занятости: минуты в каждом часе дня */
export interface SalonLoad {
  date: string
  hours: number[]
  load: number | null // % занятости салона
  masters: {
    id: number
    name: string
    load: number | null // null — выходной
    cells: { hour: number; work: number; busy: number; blocked: number }[]
  }[]
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
  actual_hours: number
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