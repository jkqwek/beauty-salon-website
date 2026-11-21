import { useState, type FormEvent } from "react"
import { useOutletContext } from "react-router"
import { Check, Copy, CreditCard, Gift, Send } from "lucide-react"
import { useAuth } from "@/auth/AuthContext"
import { giftApi, type GiftCertificate } from "@/api/api"
import { useApi } from "@/api/useApi"
import { fieldMessages, toApiError, type ApiError } from "@/api/client"
import { formatDate, formatPrice } from "@/lib/format"
import { t } from "@/lib/i18n"
import { ErrorMessage } from "../components/ErrorMessage"

const MIN_AMOUNT = 500
const MAX_AMOUNT = 50000
const PRESETS = [1000, 2000, 3000, 5000]

const STATUS: Record<GiftCertificate["status"], { label: string; tone: string }> = {
  pending: { label: "Ждёт оплаты в салоне", tone: "bg-amber-50 text-amber-700" },
  active: { label: "Действует", tone: "bg-emerald-50 text-emerald-700" },
  used: { label: "Использован", tone: "bg-gray-100 text-gray-600" },
  expired: { label: "Срок истёк", tone: "bg-rose-50 text-rose-700" },
}

const STEPS = [
  { icon: Gift, title: "Закажите на сайте", text: "Выберите сумму и напишите поздравление — код сертификата появится сразу." },
  { icon: CreditCard, title: "Оплатите в салоне", text: "Назовите код администратору и оплатите. После этого сертификат начинает действовать." },
  { icon: Send, title: "Подарите", text: "Передайте код получателю: он вводит его при записи, и стоимость услуги списывается с сертификата." },
]

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-rose-200 bg-white focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-shadow"

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* буфер обмена недоступен — код можно выделить вручную */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-sm text-gold-dark hover:text-gold font-medium"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? t("Скопировано") : t("Скопировать код")}
    </button>
  )
}

function MyCertificates({ version }: { version: number }) {
  const { user } = useAuth()
  const gifts = useApi(giftApi.my, [user?.id, version])
  if (gifts.error) return <ErrorMessage error={gifts.error} onRetry={gifts.reload} />
  if (!gifts.data?.length) return null
  return (
    <section className="mt-16">
      <h2 className="text-3xl font-serif text-foreground mb-6 text-center">{t("Мои сертификаты")}</h2>
      <div className="space-y-4">
        {gifts.data.map((g) => (
          <div key={g.id} className="bg-white rounded-3xl border border-rose-100 p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-lg text-foreground tracking-wide">{g.code}</p>
              <p className="text-sm text-muted-foreground">
                {g.recipient_name ? `${t("Для")} ${g.recipient_name} · ` : ""}
                {t("до {date}", { date: formatDate(g.valid_until) })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground">
                {formatPrice(g.balance)} <span className="text-muted-foreground font-normal">{t("из")} {formatPrice(g.amount)}</span>
              </p>
              <span className={`inline-block mt-1 text-xs px-2.5 py-1 rounded-full ${STATUS[g.status].tone}`}>
                {t(STATUS[g.status].label)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function GiftPage() {
  const { user } = useAuth()
  const { openAuth } = useOutletContext<{ openAuth: () => void }>()
  const [amount, setAmount] = useState<number | "">(3000)
  const [recipient, setRecipient] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [ordered, setOrdered] = useState<GiftCertificate | null>(null)
  const [version, setVersion] = useState(0) // чтобы список «Мои сертификаты» перечитался после заказа

  const amountError =
    amount === "" || amount < MIN_AMOUNT || amount > MAX_AMOUNT
      ? t("Сумма — от {min} до {max} ₽", { min: MIN_AMOUNT, max: MAX_AMOUNT })
      : null
  const fields = error ? fieldMessages(error) : {}

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return openAuth()
    if (amountError) return
    setBusy(true)
    setError(null)
    try {
      setOrdered(await giftApi.order({ amount: Number(amount), recipient_name: recipient.trim(), message: message.trim() }))
      setVersion((v) => v + 1)
    } catch (err) {
      setError(toApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 bg-pearl pb-24">
      <div className="bg-rose-50 border-b border-rose-100 py-16 px-6 text-center">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground mb-4">{t("Подарочные сертификаты")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t("Подарите близким заботу о себе: сертификат действует на любые услуги салона в течение года.")}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {STEPS.map((step, i) => (
            <div key={step.title} className="bg-white rounded-3xl border border-rose-100 p-6 text-center">
              <div className="size-12 rounded-full bg-rose-50 text-gold flex items-center justify-center mx-auto mb-3">
                <step.icon className="size-6 stroke-[1.5]" />
              </div>
              <h3 className="font-serif text-lg text-foreground mb-1">
                {i + 1}. {t(step.title)}
              </h3>
              <p className="text-sm text-muted-foreground">{t(step.text)}</p>
            </div>
          ))}
        </div>

        {ordered ? (
          <div className="bg-white rounded-3xl border border-gold/40 shadow-sm p-8 text-center space-y-3">
            <h2 className="text-2xl font-serif text-foreground">{t("Сертификат заказан")}</h2>
            <p className="font-mono text-3xl tracking-wider text-gold-dark">{ordered.code}</p>
            <CopyCode code={ordered.code} />
            <p className="text-foreground font-medium">{formatPrice(ordered.amount)}</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t("Сертификат начнёт действовать, когда вы оплатите его в салоне — назовите администратору этот код.")}
            </p>
            <button
              type="button"
              onClick={() => setOrdered(null)}
              className="text-gold-dark hover:text-gold font-medium"
            >
              {t("Заказать ещё один")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 md:p-8 space-y-6">
            <div>
              <p className="text-muted-foreground mb-2">{t("Сумма")}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(value)}
                    className={`px-5 py-2 rounded-full border transition-colors ${
                      amount === value ? "bg-gold text-white border-gold" : "border-rose-200 text-foreground hover:border-gold"
                    }`}
                  >
                    {formatPrice(String(value))}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                aria-label={t("Сумма")}
                aria-invalid={Boolean(amountError)}
                className={inputClass}
              />
              {(amountError || fields.amount) && <p className="text-xs text-rose-600 mt-1">{amountError ?? fields.amount}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gift-recipient" className="text-muted-foreground">{t("Для кого (необязательно)")}</label>
              <input
                id="gift-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                maxLength={100}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="gift-message" className="text-muted-foreground">{t("Поздравление (необязательно)")}</label>
              <textarea
                id="gift-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={300}
                rows={3}
                className={inputClass}
              />
            </div>

            {error && <ErrorMessage error={error} />}

            <button
              type="submit"
              disabled={busy || (Boolean(user) && Boolean(amountError))}
              className="w-full bg-gold hover:bg-gold-hover disabled:opacity-60 text-white px-8 py-3 rounded-full font-medium transition-colors"
            >
              {!user ? t("Войти и заказать") : busy ? t("Оформляем…") : t("Заказать сертификат")}
            </button>
          </form>
        )}

        {user && <MyCertificates version={version} />}
      </div>
    </div>
  )
}
