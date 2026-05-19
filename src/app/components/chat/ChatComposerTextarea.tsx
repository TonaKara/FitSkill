"use client"

import { useCallback, useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"

const MIN_ROWS = 1
const MAX_ROWS = 6
/** text-sm + leading-6 に合わせた1行の高さ（px） */
const LINE_HEIGHT_PX = 24
const PADDING_Y_PX = 16

function maxTextareaHeightPx(): number {
  return LINE_HEIGHT_PX * MAX_ROWS + PADDING_Y_PX
}

function minTextareaHeightPx(): number {
  return LINE_HEIGHT_PX * MIN_ROWS + PADDING_Y_PX
}

function resizeTextarea(el: HTMLTextAreaElement) {
  const maxHeight = maxTextareaHeightPx()
  const minHeight = minTextareaHeightPx()
  el.style.height = "auto"
  const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden"
}

export type ChatComposerTextareaProps = {
  value: string
  onChange: (value: string) => void
  /** デスクトップで Enter のみ押下時（Shift+Enter は改行） */
  onSubmit?: () => void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
  id?: string
  "aria-label"?: string
}

export function ChatComposerTextarea({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  maxLength,
  className,
  id,
  "aria-label": ariaLabel,
}: ChatComposerTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const syncHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) {
      return
    }
    resizeTextarea(el)
  }, [])

  useLayoutEffect(() => {
    syncHeight()
  }, [value, syncHeight])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return
    }
    const prefersDesktopSend =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
    if (!prefersDesktopSend || !onSubmit || disabled) {
      return
    }
    event.preventDefault()
    onSubmit()
  }

  return (
    <textarea
      ref={textareaRef}
      id={id}
      rows={MIN_ROWS}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel ?? placeholder}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "min-h-[2.5rem] min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground",
        "placeholder:text-muted-foreground",
        "transition-[height,border-color,box-shadow] duration-150",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        maxHeight: maxTextareaHeightPx(),
        overflowY: "hidden",
      }}
    />
  )
}
