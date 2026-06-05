"use client"

import { EyeOff, X } from "lucide-react"
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

function MessageActionButtons({
  isMine,
  onDelete,
  onHide,
  placement,
}: {
  isMine: boolean
  onDelete?: () => void
  onHide?: () => void
  placement: "inline" | "overlay"
}) {
  if (!onDelete && !onHide) return null

  const overlaySide = isMine ? "-left-9" : "-right-9"

  return (
    <>
      {placement === "inline" ? (
        <div
          className={cn(
            "flex shrink-0 gap-1 pt-1 md:hidden",
            isMine && "flex-row-reverse",
          )}
        >
          {onHide ? (
            <button
              type="button"
              onClick={onHide}
              aria-label="メッセージを非表示"
              className={messageActionButtonClass}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label="メッセージを削除"
              className={messageActionButtonClass}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {onHide ? (
            <button
              type="button"
              onClick={onHide}
              aria-label="メッセージを非表示"
              className={cn(
                messageActionButtonClass,
                "absolute top-1 z-10 hidden md:inline-flex",
                overlaySide,
              )}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              aria-label="メッセージを削除"
              className={cn(
                messageActionButtonClass,
                "absolute top-1 z-10 hidden md:inline-flex",
                overlaySide,
              )}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </>
      )}
    </>
  )
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
  const hasActions = Boolean(onDelete || onHide)

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={cn(
          "group relative max-w-[85%]",
          hasActions && "max-md:flex max-md:items-start max-md:gap-1.5",
          hasActions && isMine && "max-md:flex-row-reverse",
        )}
      >
        <MessageActionButtons
          isMine={isMine}
          onDelete={onDelete}
          onHide={onHide}
          placement="inline"
        />
        <div className="relative min-w-0 max-md:flex-1">
          <MessageActionButtons
            isMine={isMine}
            onDelete={onDelete}
            onHide={onHide}
            placement="overlay"
          />
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
        </div>
        {footer}
      </div>
    </div>
  )
}
