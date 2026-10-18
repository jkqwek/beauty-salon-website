import { useEffect, useState } from "react"
import { X, CheckCircle2 } from "lucide-react"
import { bookingApi, catalogApi, type Booking, type Employee, type Service } from "@/api/api"
import { toApiError, type ApiError } from "@/api/client"
import { useApi } from "@/api/useApi"
import { formatDate, formatDuration } from "@/lib/format"
import { masterPhoto } from "@/lib/photos"
import { Avatar } from "./Avatar"
import { BookingCalendar, SlotPicker } from "./BookingCalendar"
import { ErrorMessage } from "./ErrorMessage"
import { PriceTag } from "./PriceTag"

/** «Записаться снова»: услуга и мастер из прошлого визита */
export interface BookingPrefill {
  serviceId: number
  employeeId: number
}

interface BookingWizardProps {
  onClose: () => void
  prefill?: BookingPrefill | null
}

export function BookingWizard({ onClose, prefill }: BookingWizardProps) {
  const [step, setStep] = useState(1)
  const [service, setService] = useState<Service | null>(null)
  const [master, setMaster] = useState<Employee | "any" | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)

  const [slotMap, setSlotMap] = useState<Record<string, number>>({}) // "10:00" -> id мастера
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<ApiError | null>(null)
  const [slotsAttempt, setSlotsAttempt] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const [created, setCreated] = useState<Booking | null>(null)

  const services = useApi(catalogApi.services)
  const employees = useApi(
    () => (service ? catalogApi.employees(service.id) : Promise.resolve([] as Employee[])),
    [service?.id],
  )
  // цена на выбранную дату: акции считаются по дате визита
  const quote = useApi(
    () => (service && date ? bookingApi.price(service.id, date) : Promise.resolve(null)),
    [service?.id, date],
  )

  // «Записаться снова»: сразу к выбору даты. Мастер больше не делает услугу — к выбору мастера,
  // услугу убрали из каталога — обычная запись с первого шага
  useEffect(() => {
    if (!prefill || !services.data) return
    const svc = services.data.find((s) => s.id === prefill.serviceId)
    if (!svc) return
    setService(svc)
    let cancelled = false
    catalogApi
      .employees(svc.id)
      .then((list) => {
        if (cancelled) return
        const same = list.find((e) => e.id === prefill.employeeId)
        if (same) setMaster(same)
        setStep(same ? 3 : 2)
      })
      .catch(() => !cancelled && setStep(2))
    return () => {
      cancelled = true
    }
  }, [services.data])

  // Шаг 3: свободные слоты. Для «Любой мастер» опрашиваем всех подходящих мастеров
  useEffect(() => {
    if (step !== 3 || !service || !master || !date) return
    const candidates = master === "any" ? (employees.data ?? []) : [master]
    let cancelled = false

    setSlotsLoading(true)
    setSlotsError(null)
    setTime(null)

    Promise.all(
      candidates.map((e) =>
        bookingApi
          .slots({ employeeId: e.id, serviceId: service.id, date })
          .then((r) => ({ id: e.id, slots: r.slots })),
      ),
    )
      .then((results) => {
        if (cancelled) return
        const map: Record<string, number> = {}
        for (const { id, slots } of results) {
          for (const s of slots) if (!(s in map)) map[s] = id
        }
        setSlotMap(map)
      })
      .catch((e) => !cancelled && setSlotsError(toApiError(e)))
      .finally(() => !cancelled && setSlotsLoading(false))

    return () => {
      cancelled = true
    }
  }, [step, service, master, date, slotsAttempt])

  const times = Object.keys(slotMap).sort()
  const employeeId = time ? slotMap[time] : undefined
  const chosenEmployee = employees.data?.find((e) => e.id === employeeId)

  const chooseService = (s: Service) => {
    setService(s)
    setMaster(null)
    setDate(null)
    setTime(null)
  }

  const submit = async () => {
    if (!service || !date || !time || !employeeId) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      setCreated(
        await bookingApi.create({
          employee: employeeId,
          service: service.id,
          date,
          start_time: time,
        }),
      )
    } catch (e) {
      const err = toApiError(e)
      setSubmitError(err)
      // Время могли занять, пока клиент выбирал — возвращаем к выбору времени
      if (err.fieldErrors.start_time || err.fieldErrors.date) setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-rose-50 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <h2 className="text-2xl font-serif text-foreground">Запись</h2>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`size-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                      step === s
                        ? "bg-gold text-white"
                        : step > s
                          ? "bg-gold/20 text-gold"
                          : "bg-rose-100 text-muted-foreground"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-8 h-[2px] rounded-full ${
                        step > s ? "bg-gold/40" : "bg-rose-100"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 hide-scrollbar">
          {created ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="size-20 rounded-full bg-gold/10 flex items-center justify-center">
                <div className="size-14 rounded-full bg-gold flex items-center justify-center text-white">
                  <CheckCircle2 className="size-8" />
                </div>
              </div>
              <h3 className="text-3xl font-serif text-foreground">Вы записаны!</h3>
              <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-1">
                Запись ждёт подтверждения салоном — статус виден в личном кабинете
              </p>
              <p className="text-muted-foreground">
                {created.service_name} • {created.employee_name}
                <br />
                {formatDate(created.date)}, {created.start_time.slice(0, 5)}
              </p>
            </div>
          ) : (
            <>
              {submitError && (
                <div className="mb-6">
                  <ErrorMessage error={submitError} />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-serif text-foreground mb-6">Выберите услугу</h3>
                  {services.loading && <p className="text-muted-foreground">Загрузка…</p>}
                  {services.error && (
                    <ErrorMessage error={services.error} onRetry={services.reload} />
                  )}
                  {services.data?.map((svc) => (
                    <div
                      key={svc.id}
                      onClick={() => chooseService(svc)}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        service?.id === svc.id
                          ? "border-gold bg-white shadow-sm"
                          : "border-transparent bg-white hover:border-gold/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-foreground text-lg">{svc.name}</h4>
                          <p className="text-sm text-muted-foreground flex flex-wrap items-baseline gap-x-1">
                            {formatDuration(svc.duration_minutes)} •{" "}
                            <PriceTag base={svc.price} price={svc.price_today} discount={svc.discount_percent} />
                          </p>
                        </div>
                        <div
                          className={`size-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                            service?.id === svc.id
                              ? "border-gold bg-gold text-white"
                              : "border-rose-200"
                          }`}
                        >
                          {service?.id === svc.id && <CheckCircle2 className="size-4" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <h3 className="text-xl font-serif text-foreground mb-2">Выберите мастера</h3>
                  {employees.loading && <p className="text-muted-foreground">Загрузка…</p>}
                  {employees.error && (
                    <ErrorMessage error={employees.error} onRetry={employees.reload} />
                  )}
                  {employees.data?.length === 0 && (
                    <p className="text-muted-foreground">
                      Для этой услуги пока нет мастеров. Выберите другую услугу.
                    </p>
                  )}
                  {!!employees.data?.length && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[...employees.data, "any" as const].map((m) => {
                        const isAny = m === "any"
                        const selected = isAny ? master === "any" : master !== "any" && master?.id === m.id
                        return (
                          <div
                            key={isAny ? "any" : m.id}
                            onClick={() => setMaster(m)}
                            className={`flex flex-col items-center p-4 rounded-2xl border-2 cursor-pointer transition-all text-center ${
                              selected
                                ? "border-gold bg-white shadow-sm"
                                : "border-transparent bg-white hover:border-gold/30"
                            }`}
                          >
                            <div
                              className={`size-16 rounded-full p-1 border-2 mb-3 transition-colors ${
                                selected ? "border-gold" : "border-transparent"
                              }`}
                            >
                              <div className="size-full rounded-full bg-rose-100 overflow-hidden flex items-center justify-center text-rose-400">
                                {isAny ? (
                                  <span className="font-serif text-sm">Любой</span>
                                ) : (
                                  <Avatar src={masterPhoto(m)} name={m.full_name} className="size-full text-base" />
                                )}
                              </div>
                            </div>
                            <span className="font-medium text-sm text-foreground">
                              {isAny ? "Любой" : m.full_name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <h3 className="text-xl font-serif text-foreground">Выберите дату и время</h3>

                  {service && master && (
                    <BookingCalendar
                      serviceId={service.id}
                      employeeId={master === "any" ? null : master.id}
                      value={date}
                      onChange={(iso) => {
                        setDate(iso)
                        setSubmitError(null)
                      }}
                    />
                  )}

                  <div>
                    <h4 className="font-medium text-foreground mb-4">Свободное время</h4>
                    {!date && (
                      <p className="text-sm text-muted-foreground">
                        Выберите дату, чтобы увидеть свободное время.
                      </p>
                    )}
                    {date && slotsLoading && <p className="text-muted-foreground">Загрузка…</p>}
                    {date && slotsError && (
                      <ErrorMessage
                        error={slotsError}
                        onRetry={() => setSlotsAttempt((n) => n + 1)}
                      />
                    )}
                    {date && !slotsLoading && !slotsError && times.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        На эту дату свободного времени нет — выберите другой день.
                      </p>
                    )}
                    {date && !slotsLoading && (
                      <SlotPicker
                        slots={times}
                        value={time}
                        onChange={(t) => {
                          setTime(t)
                          setSubmitError(null)
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                  <div className="size-20 rounded-full bg-gold/10 flex items-center justify-center mb-2">
                    <div className="size-14 rounded-full bg-gold flex items-center justify-center text-white">
                      <CheckCircle2 className="size-8" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-serif text-foreground">Подтвердите запись</h3>

                  <div className="w-full bg-white rounded-2xl border border-rose-100 p-6 text-left space-y-4 mt-4">
                    <div className="flex justify-between items-center pb-4 border-b border-rose-50">
                      <span className="text-muted-foreground">Услуга</span>
                      <span className="font-medium text-foreground">{service?.name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-rose-50">
                      <span className="text-muted-foreground">Мастер</span>
                      <span className="font-medium text-foreground">{chosenEmployee?.full_name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-4 border-b border-rose-50">
                      <span className="text-muted-foreground">Дата и время</span>
                      <span className="font-medium text-foreground">
                        {date && formatDate(date)}, {time}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground">Цена</span>
                      <span className="font-medium text-foreground text-right">
                        {quote.data ? (
                          <>
                            <PriceTag base={quote.data.base_price} price={quote.data.price} discount={quote.data.discount_percent} />
                            {quote.data.promotion && (
                              <span className="block text-xs text-muted-foreground font-normal">Акция «{quote.data.promotion}»</span>
                            )}
                          </>
                        ) : (
                          "…"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white p-6 border-t border-rose-100 flex items-center justify-between shrink-0">
          {created ? (
            <>
              <span />
              <button
                onClick={onClose}
                className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors shadow-sm"
              >
                Готово
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setSubmitError(null)
                  step > 1 ? setStep(step - 1) : onClose()
                }}
                className="text-muted-foreground font-medium hover:text-foreground transition-colors px-4 py-2"
              >
                {step > 1 ? "Назад" : "Отмена"}
              </button>

              {step < 4 ? (
                <button
                  onClick={() => {
                    setSubmitError(null)
                    setStep(step + 1)
                  }}
                  disabled={
                    (step === 1 && !service) ||
                    (step === 2 && !master) ||
                    (step === 3 && !time)
                  }
                  className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  Продолжить
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="bg-gold hover:bg-gold-hover text-white px-8 py-3 rounded-full font-medium transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="size-5" />
                  {submitting ? "Отправка…" : "Подтвердить запись"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}