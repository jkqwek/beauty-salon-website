import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { ImagePlus, Trash, X } from "lucide-react"
import { errorText, toApiError } from "@/api/client"
import { ErrorMessage } from "./ErrorMessage"

const VIEW = 288 // сторона рамки кадрирования на экране, px
const OUT = 600 // сторона итоговой картинки, px
const MAX_BYTES = 10 * 1024 * 1024
const MAX_ZOOM = 4

interface Props {
  title: string
  hasPhoto: boolean
  onSave: (photo: Blob) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onClose: () => void
}

/** Выбор фото и ручное кадрирование: перетащить, приблизить, сохранить квадрат 600×600 */
export function AvatarCropper({ title, hasPhoto, onSave, onDelete, onClose }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1) // 1 — фото ровно закрывает рамку
  const [pos, setPos] = useState({ x: 0, y: 0 }) // левый верхний угол фото относительно рамки
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const drag = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.src) // освобождаем память от прошлого выбранного файла
  }, [img])

  const cover = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1
  const scale = cover * zoom
  // фото всегда закрывает рамку целиком — пустых краёв в аватаре не будет
  const clamp = (p: { x: number; y: number }, s = scale) => ({
    x: Math.min(0, Math.max(VIEW - img!.naturalWidth * s, p.x)),
    y: Math.min(0, Math.max(VIEW - img!.naturalHeight * s, p.y)),
  })

  const pick = (file?: File) => {
    setError(null)
    if (!file) return
    if (!["image/jpeg", "image/png"].includes(file.type)) return setError("Подходят только JPG и PNG.")
    if (file.size > MAX_BYTES) return setError("Файл больше 10 МБ.")
    const image = new Image()
    image.onload = () => {
      const c = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight)
      setImg(image)
      setZoom(1)
      setPos({ x: (VIEW - image.naturalWidth * c) / 2, y: (VIEW - image.naturalHeight * c) / 2 }) // по центру
    }
    image.onerror = () => setError("Не получилось открыть файл.")
    image.src = URL.createObjectURL(file)
  }

  const changeZoom = (next: number) => {
    const k = next / zoom
    const c = VIEW / 2 // приближаем к центру рамки, а не к углу
    setPos(clamp({ x: c - (c - pos.x) * k, y: c - (c - pos.y) * k }, cover * next))
    setZoom(next)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setPos(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }
    const step = moves[e.key]
    if (!step) return
    e.preventDefault()
    setPos(clamp({ x: pos.x + step[0], y: pos.y + step[1] }))
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (e) {
      setError(errorText(toApiError(e)))
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const canvas = document.createElement("canvas")
      canvas.width = canvas.height = OUT
      // видимый квадрат рамки в координатах исходного фото -> 600×600
      canvas.getContext("2d")!.drawImage(img!, -pos.x / scale, -pos.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9))
      if (!blob) throw new Error("canvas")
      await onSave(blob)
    })

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-rose-50 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="bg-white p-6 border-b border-rose-100 flex items-center justify-between">
          <h2 className="text-2xl font-serif text-foreground">{title}</h2>
          <button onClick={onClose} aria-label="Закрыть" className="p-2 text-muted-foreground hover:text-foreground transition-colors bg-rose-50 rounded-full">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-5">
          {img ? (
            <>
              <div
                tabIndex={0}
                aria-label="Область кадрирования: перетащите фото или двигайте стрелками"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onKeyDown={onKeyDown}
                className="relative overflow-hidden rounded-2xl bg-rose-100 cursor-grab active:cursor-grabbing touch-none focus:outline-none focus:ring-2 focus:ring-gold"
                style={{ width: VIEW, height: VIEW }}
              >
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none select-none pointer-events-none"
                  style={{ left: pos.x, top: pos.y, width: img.naturalWidth * scale, height: img.naturalHeight * scale }}
                />
                {/* круглое превью: всё вне круга затемнено — так аватар и будет выглядеть */}
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{ boxShadow: "0 0 0 999px rgb(0 0 0 / 0.45)" }} />
              </div>
              <label className="w-full flex items-center gap-3 text-sm text-muted-foreground">
                Масштаб
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => changeZoom(Number(e.target.value))}
                  className="flex-1 accent-gold"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              JPG или PNG, до 10 МБ. После выбора фото можно подвинуть и приблизить.
            </p>
          )}

          {error && <ErrorMessage error={error} />}

          <div className="flex flex-wrap gap-3 justify-center">
            <label className="flex items-center gap-2 px-5 py-2 rounded-full border border-gold text-gold font-medium hover:bg-gold/10 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-gold">
              <ImagePlus className="size-4" /> {img ? "Другое фото" : "Выбрать фото"}
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {hasPhoto && !img && (
              <button
                onClick={() => confirm("Удалить фото?") && run(onDelete)}
                disabled={busy}
                className="flex items-center gap-2 px-5 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-600 font-medium hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                <Trash className="size-4" /> Удалить фото
              </button>
            )}
          </div>

          {img && (
            <button
              onClick={save}
              disabled={busy}
              className="w-full bg-gold hover:bg-gold-hover text-white py-3 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Сохранение…" : "Сохранить"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
