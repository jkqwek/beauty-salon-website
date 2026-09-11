import React, { useState } from "react"
import { ImageOff } from "lucide-react"

interface ImageWithFallbackProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string
}

export function ImageWithFallback({
  src,
  alt,
  className,
  fallbackClassName,
  ...props
}: ImageWithFallbackProps) {
  const [error, setError] = useState(false)

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-rose-100 text-rose-300 ${className} ${fallbackClassName || ""}`}
      >
        <ImageOff className="size-1/3 opacity-50" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  )
}
