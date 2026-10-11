import { AlertCircle } from "lucide-react"
import { errorText, type ApiError } from "@/api/client"

interface Props {
  error: ApiError | string
  onRetry?: () => void
}

export function ErrorMessage({ error, onRetry }: Props) {
  const message = typeof error === "string" ? error : errorText(error)
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
    >
      <AlertCircle className="size-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 font-medium underline underline-offset-2 hover:text-rose-900"
          >
            Повторить
          </button>
        )}
      </div>
    </div>
  )
}