import { api } from "./client"

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  avatar: string | null
  is_staff: boolean
  is_blocked: boolean | null
}

export type ProfileData = Pick<User, "first_name" | "last_name" | "email"> & { phone: string }

/** Файл (обрезанное фото) для multipart-загрузки */
const fileForm = (field: string, blob: Blob, filename = "photo.jpg") => {
  const form = new FormData()
  form.append(field, blob, filename)
  return form
}

export interface Service {
  id: number
  name: string
  description: string
  price: string
  duration_minutes: number
  category: string
  image: string | null          // <-- новое поле
  is_active: boolean
  price_today: string
  discount_percent: number
  promotion: string | null
  deleted_at?: string | null
  future_bookings?: number | null
}

export interface Employee {
  id: number
  full_name: string
  specialization: string
  photo: string | null
  services: number[]
  rating?: string | null
  reviews_count?: number
  is_active?: boolean
}

export interface Booking {
  id: number
  employee: number
  employee_name: string
  service: number
  service_name: string
  date: string
  start_time: string
  end_time: string
  status: "pending" | "confirmed" | "completed" | "cancelled"
  client: number
  actual_start: string | null
  actual_end: string | null
  price: string | null
  rating: number | null
  review_status: ReviewStatus | null
}

export type ReviewStatus = "new" | "published" | "rejected"

export interface AvailableDays {
  available: string[]
  holidays: Record<string, string>
}

export interface PriceQuote {
  price: string
  base_price: string
  discount_percent: number
  promotion: string | null
}

const query = (params: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]),
  ).toString()

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

  // --- Услуги: фото ---
  uploadServiceImage: (id: number, blob: Blob) =>
    api<Service>(`/services/${id}/image/`, { method: "PUT", body: fileForm("image", blob, "service.jpg") }),
  deleteServiceImage: (id: number) =>
    api<Service>(`/services/${id}/image/`, { method: "DELETE" }),

  // --- Мастера: фото ---
  uploadMasterPhoto: (id: number, blob: Blob) =>
    api<Employee>(`/employees/${id}/photo/`, { method: "PUT", body: fileForm("photo", blob) }),
  deleteMasterPhoto: (id: number) =>
    api<Employee>(`/employees/${id}/photo/`, { method: "DELETE" }),
}

export const bookingApi = {
  slots: (p: { employeeId?: number; serviceId?: number; bookingId?: number; date: string }) =>
    api<{ slots: string[] }>(
      `/bookings/available-slots/?${query({ employee_id: p.employeeId, service_id: p.serviceId, booking_id: p.bookingId, date: p.date })}`,
    ),
  availableDays: (p: { serviceId?: number; employeeId?: number | null; bookingId?: number; month: string }) =>
    api<AvailableDays>(
      `/bookings/available-days/?${query({ service_id: p.serviceId, employee_id: p.employeeId, booking_id: p.bookingId, month: p.month })}`,
    ),
  price: (serviceId: number, date: string) =>
    api<PriceQuote>(`/bookings/price/?${query({ service_id: serviceId, date })}`),
  reschedule: (id: number, date: string, start_time: string) =>
    api<Booking>(`/bookings/${id}/reschedule/`, { method: "POST", body: { date, start_time } }),
  review: (id: number, data: { rating: number; text: string }) =>
    api<Booking>(`/bookings/${id}/review/`, { method: "POST", body: data }),
  upcomingClosures: () => api<Closure[]>("/bookings/closures/upcoming/"),
  create: (data: { employee: number; service: number; date: string; start_time: string }) =>
    api<Booking>("/bookings/", { method: "POST", body: data }),
  my: () => api<Booking[]>("/bookings/my/"),
  cancel: (id: number) => api<Booking>(`/bookings/${id}/cancel/`, { method: "POST" }),
  cancellationPolicy: () => api<CancellationPolicy>("/bookings/cancellation-policy/"),
}

export interface CancellationPolicy {
  deadline_hours: number
}

export interface CabinetClient {
  id: number
  name: string
  visits: number
  phone: string
  note: string
  is_regular: boolean
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
  is_regular: boolean | null
  is_candidate: boolean
  is_blocked: boolean | null
  blocked_reason: string | null
  blocked_at: string | null
  date_joined: string
  visits: number
  last_visit: string | null
  total_spent: string | null
  note: string | null
  master: string | null
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
  counters: () => api<PanelCounters>("/admin/counters/"),
  todayStats: () => api<TodayStats>("/admin/stats/today/"),
  restoreService: (id: number) => api<Service>(`/services/${id}/restore/`, { method: "POST" }),
  closureConflicts: (p: { date_from: string; date_to: string; open_time?: string | null; close_time?: string | null }) =>
    api<string[]>(`/admin/closures/conflicts/?${query(p)}`),
  setBookingStatus: (id: number, status: Booking["status"]) =>
    api<AdminBooking>(`/admin/bookings/${id}/`, { method: "PATCH", body: { status } }),
  load: (date: string) => api<SalonLoad>(`/admin/load/?date=${date}`),
  setCancellationPolicy: (data: CancellationPolicy) =>
    api<CancellationPolicy>("/bookings/cancellation-policy/", { method: "PATCH", body: data }),
}

export interface SalonLoad {
  date: string
  hours: number[]
  load: number | null
  masters: {
    id: number
    name: string
    load: number | null
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

function toQueryString(params: object) {
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

export interface PanelCounters {
  pending_bookings: number
  new_reviews: number
  today_bookings: number
}

export interface TodayStats {
  date: string
  total: number
  by_status: Record<Booking["status"], number>
  expected_revenue: string
}

export interface Closure {
  name: string
  date_from: string
  date_to: string
  open_time: string | null
  close_time: string | null
}

export interface PublicReview {
  id: number
  rating: number
  text: string
  reply: string
  created_at: string
  author: string
  author_avatar: string | null
  employee_id: number
  employee_name: string
  service_name: string
}

export const reviewsApi = {
  list: (p: { employee?: number | null; minRating?: number; limit?: number } = {}) =>
    api<{ average: number | null; count: number; results: PublicReview[] }>(
      `/reviews/?${query({ employee: p.employee, min_rating: p.minRating, limit: p.limit })}`,
    ),
}

export interface Promotion {
  id: number
  name: string
  description: string
  discount_percent: number
  date_from: string
  date_to: string
  services: string[]
  is_current: boolean
}

export const promotionsApi = {
  current: () => api<Promotion[]>("/promotions/"),
}