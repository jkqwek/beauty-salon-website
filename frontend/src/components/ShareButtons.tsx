import { Share2 } from "lucide-react"

interface ShareButtonsProps {
  url: string
  title: string
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`

  return (
    <div className="flex items-center gap-2">
      <Share2 className="size-4 text-muted-foreground" />
      <a
        href={vkUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs font-medium text-muted-foreground hover:text-gold transition-colors"
      >
        ВКонтакте
      </a>
      <span className="text-muted-foreground">·</span>
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs font-medium text-muted-foreground hover:text-gold transition-colors"
      >
        Telegram
      </a>
    </div>
  )
}