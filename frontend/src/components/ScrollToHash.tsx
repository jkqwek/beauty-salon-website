// src/components/ScrollToHash.tsx
import { useEffect } from "react"
import { useLocation } from "react-router"

export function ScrollToHash() {
  const { hash, pathname } = useLocation()

  useEffect(() => {
    if (hash) {
      const elementId = hash.replace("#", "")
      const element = document.getElementById(elementId)
      
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
      }
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [hash, pathname])

  return null
}