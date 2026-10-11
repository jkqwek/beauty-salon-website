import { api } from "./client"

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar: string | null
  is_staff: boolean // сотрудник: полные права
  is_blocked: boolean | null // чёрный список: онлайн-запись недоступна
}

export type ProfileData = Pick<User, "first_name" | "last_name" | "email"> & { phone: string }

/** Файл (обрезанное фото) для multipart-загрузки */
const fileForm = (field: string, blob: Blob) => {
  const form = new FormData()
  form.append(field, blob, "photo.jpg")
  return form
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
  is_active?: boolean // приходит только сотрудникам
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
  status: "pending" | "confirmed" | "completed" | "cancelled"
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
  updateMe: (data: ProfileData) => api<User>("/auth/me/", { method: "PATCH", body: data }),
  uploadAvatar: (blob: Blob) => api<User>("/auth/me/avatar/", { method: "PUT", body: fileForm("avatar", blob) }),
  deleteAvatar: () => api<User>("/auth/me/avatar/", { method: "DELETE" }),
}

export const catalogApi = {
  services: () => api<Service[]>("/services/"),
  employees: (serviceId?: number) =>
    api<Employee[]>(serviceId ? `/employees/?service=${serviceId}` : "/employees/"),
  uploadMasterPhoto: (id: number, blob: Blob) =>
    api<Employee>(`/employees/${id}/photo/`, { method: "PUT", body: fileForm("photo", blob) }),
  deleteMasterPhoto: (id: number) => api<Employee>(`/employees/${id}/photo/`, { method: "DELETE" }),
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
  is_regular: boolean // ⭐ постоянный клиент
}

export interface EmployeeCabinet {
  employee: string
  employee_photo: string | null
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
  avatar: string | null
  is_staff: boolean
  is_regular: boolean | null // ⭐ ставит сотрудник
  is_candidate: boolean // подсказка ⭐: часто ходит, но ещё не отмечен
  is_blocked: boolean | null // чёрный список
  blocked_reason: string | null
  blocked_at: string | null
  date_joined: string
  visits: number // по завершённым записям
  last_visit: string | null
  total_spent: string | null
  note: string | null
  master: string | null // карточка мастера, к которой привязан аккаунт
}

export interface AdminBooking extends Booking {
  client_name: string
  client_is_regular: boolean | null
  client_is_blocked: boolean | null
  price: string | null
}

export const adminApi = {
  users: () => api<AdminUser[]>("/admin/users/"),
  bookings: (from: string, to: string) =>
    api<AdminBooking[]>(`/admin/bookings/?date_from=${from}&date_to=${to}`),
  pendingCount: () => api<{ count: number }>("/admin/bookings/pending-count/"),
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