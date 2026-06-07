"use client"

import { EyeOff, X } from "lucide-react"
import { useTranslations } from "@/lib/i18n/useI18n"
import { ChatImageAttachment } from "@/talk/_chat-image"
import { messageActionButtonClass } from "@/talk/_message-bubble-actions"
import { cn } from "@/lib/utils"

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
  const tChat = useTranslations("talk.chat")

  const hasActions = Boolean(onDelete || onHide)
  /** 送信直後（pending）でも幅が変わらないよう、自分の吹き出しは常に左余白を確保 */
  const showActionColumn = hasActions || isMine || Boolean(onHide)

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className="group flex max-w-[85%] items-start">
        {showActionColumn ? (
          <div className="flex shrink-0 flex-col gap-0.5 self-start pr-1.5 pt-1">
            {onHide ? (
              <button
                type="button"
                onClick={onHide}
                aria-label={tChat("hideMessage")}
                className={messageActionButtonClass}
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                aria-label={tChat("deleteMessageAria")}
                className={messageActionButtonClass}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            {!hasActions ? (
              <span className="inline-block h-8 w-8 md:h-6 md:w-6" aria-hidden />
            ) : null}
          </div>
        ) : null}
        <div className="min-w-0">
          <div
            className={cn(
              "overflow-hidden rounded-2xl text-sm leading-relaxed",
              isMine
                ? "bg-zinc-100 text-black"
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
    </div>
  )
}
