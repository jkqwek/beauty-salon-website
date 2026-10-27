import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ImageWithFallback } from "./ImageWithFallback"

export interface Work {
  image?: string
  title: string
  master: string
}

export function WorksSlider({ works }: { works: Work[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [pages, setPages] = useState(works.length)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const slideWidth = () => {
    const track = trackRef.current
    const first = track?.firstElementChild as HTMLElement | null
    if (!track || !first) return 0
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0
    return first.offsetWidth + gap
  }

  const update = useCallback(() => {
    const track = trackRef.current
    const w = slideWidth()
    if (!track || !w) return
    const maxScroll = track.scrollWidth - track.clientWidth
    const lastIndex = Math.max(0, Math.round(maxScroll / w))
    setPages(lastIndex + 1)
    setActive(Math.min(Math.round(track.scrollLeft / w), lastIndex))
    setAtStart(track.scrollLeft <= 1)
    setAtEnd(track.scrollLeft >= maxScroll - 1)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    return () => observer.disconnect()
  }, [update, works.length])

  const goTo = (index: number) => {
    const track = trackRef.current
    if (!track) return
    const i = Math.max(0, Math.min(pages - 1, index))
    track.scrollTo({ left: i * slideWidth(), behavior: "smooth" })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault()
      goTo(active + 1)
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      goTo(active - 1)
    }
  }

  const arrowClass =
    "size-11 rounded-full border-2 border-gold text-gold flex items-center justify-center transition-colors hover:bg-gold hover:text-white disabled:opacity-40 disabled:pointer-events-none"

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Работы наших мастеров">
      <div
        ref={trackRef}
        onScroll={update}
        onKeyDown={onKeyDown}
        tabIndex={0}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar focus-visible:outline-2 focus-visible:outline-gold rounded-3xl"
      >
        {works.map((work, i) => (
          <figure
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} из ${works.length}`}
            className="group relative shrink-0 snap-start overflow-hidden rounded-3xl bg-rose-100 aspect-[4/5] w-[85%] sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          >
            <ImageWithFallback
              src={work.image}
              alt={`${work.title}, работа мастера ${work.master}`}
              className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <figcaption className="absolute inset-x-0 bottom-0 p-5 pt-20 bg-gradient-to-t from-black/70 to-transparent text-white">
              <p className="font-serif text-lg leading-snug">{work.title}</p>
              <p className="text-sm text-white/80">{work.master}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <button onClick={() => goTo(active - 1)} disabled={atStart} aria-label="Предыдущая работа" className={arrowClass}>
          <ChevronLeft className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Перейти к слайду ${i + 1}`}
              aria-current={i === active}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-6 bg-gold" : "w-2 bg-rose-200 hover:bg-rose-300"
              }`}
            />
          ))}
        </div>

        <button onClick={() => goTo(active + 1)} disabled={atEnd} aria-label="Следующая работа" className={arrowClass}>
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}