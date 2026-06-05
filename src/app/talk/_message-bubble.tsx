"use client"

import { EyeOff, X } from "lucide-react"
import { ChatImageAttachment } from "@/talk/_chat-image"
import { messageActionButtonClass } from "@/talk/_message-bubble-actions"
import { cn } from "@/lib/utils"

/** 吹き出しの左外側（レイアウト幅を取らない） */
const actionButtonBesideBubbleClass =
  "absolute top-1 z-10 right-full mr-1.5"

type TalkMessageBubbleProps = {
  isMine: boolean
  body: string | null
  imagePath: string | null
  imageUrl?: string
  pending?: boolean
  onDelete?: () => void
  onHide?: () => void
  footer?: React.ReactNode
}

export function TalkMessageBubble({
  isMine,
  body,
  imagePath,
  imageUrl,
  pending,
  onDelete,
  onHide,
  footer,
}: TalkMessageBubbleProps) {
  /** 送信直後（pending）でも幅が変わらないよう、自分の吹き出しは常に左余白を確保 */
  const reserveActionSpace = isMine || Boolean(onHide)

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "group relative max-w-[85%]",
          reserveActionSpace && "ml-9 sm:ml-10",
        )}
      >
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            aria-label="メッセージを非表示"
            className={cn(messageActionButtonClass, actionButtonBesideBubbleClass)}
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="メッセージを削除"
            className={cn(messageActionButtonClass, actionButtonBesideBubbleClass)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <div
          className={cn(
            "overflow-hidden rounded-2xl text-sm leading-relaxed",
            isMine
              ? "bg-black text-white"
              : "border border-zinc-200 bg-white text-black",
            pending ? "opacity-90" : "",
          )}
        >
          {imagePath ? (
            <ChatImageAttachment imagePath={imagePath} imageUrl={imageUrl} />
          ) : null}
          {body ? (
            <p className="whitespace-pre-wrap break-words px-4 py-3">{body}</p>
          ) : null}
        </div>
        {footer}
      </div>
    </div>
  )
}
