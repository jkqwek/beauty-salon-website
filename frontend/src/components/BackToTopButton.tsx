import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-6 md:bottom-6 z-50 bg-white border border-rose-100 text-gold p-3 rounded-full shadow-lg hover:bg-rose-50 transition-transform hover:scale-105 active:scale-95"
      aria-label="Наверх"
    >
      <ArrowUp className="size-5" />
    </button>
  )
}