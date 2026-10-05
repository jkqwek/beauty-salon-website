import { CalendarCheck, Check, Clock, X, type LucideIcon } from "lucide-react"
import type { Booking } from "@/api/api"

type Status = Booking["status"]

/** Статусы записи: цвет + иконка + подпись, чтобы «ждёт» (жёлтый) не путался с «выполнена» (золото) */
export const BOOKING_STATUS: Record<Status, { label: string; cls: string; icon: LucideIcon }> = {
  pending: { label: "Ждёт подтверждения", cls: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  confirmed: { label: "Подтверждена", cls: "bg-green-50 text-green-700 border-green-200", icon: CalendarCheck },
  completed: { label: "Выполнена", cls: "bg-gold/10 text-gold-dark border-gold/40", icon: Check },
  cancelled: { label: "Отменена", cls: "bg-red-50 text-red-700 border-red-200", icon: X },
}

/** Запись ещё впереди: её можно отменить, она занимает время мастера */
export const isActiveStatus = (s: Status) => s === "pending" || s === "confirmed"

/** Событие «число ожидающих подтверждения изменилось» — счётчик в меню панели обновится сразу */
export const PENDING_CHANGED = "panel:pending-changed"

export function StatusBadge({ status }: { status: Status }) {
  const { label, cls, icon: Icon } = BOOKING_STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium whitespace-nowrap ${cls}`}>
      <Icon className="size-3.5" /> {label}
    </span>
  )
}
