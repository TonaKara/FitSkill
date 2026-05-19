"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
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

function measureTextareaContentHeight(el: HTMLTextAreaElement): number {
  const previousHeight = el.style.height
  el.style.height = "0px"
  const contentHeight = el.scrollHeight
  el.style.height = previousHeight
  return contentHeight
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
  const [heightPx, setHeightPx] = useState(minTextareaHeightPx)
  const [overflowY, setOverflowY] = useState<"auto" | "hidden">("hidden")

  const syncHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) {
      return
    }
    const maxHeight = maxTextareaHeightPx()
    const minHeight = minTextareaHeightPx()
    const contentHeight = measureTextareaContentHeight(el)
    const next = Math.min(Math.max(contentHeight, minHeight), maxHeight)
    setHeightPx(next)
    setOverflowY(contentHeight > maxHeight ? "auto" : "hidden")
  }, [])

  useLayoutEffect(() => {
    syncHeight()
  }, [value, syncHeight])

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el || typeof ResizeObserver === "undefined") {
      return
    }
    const observer = new ResizeObserver(() => {
      syncHeight()
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [syncHeight])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

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

  const maxHeight = maxTextareaHeightPx()

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
      onChange={handleChange}
      onInput={syncHeight}
      onKeyDown={handleKeyDown}
      className={cn(
        "box-border block min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground",
        "placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow] duration-150",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      style={{
        height: heightPx,
        maxHeight,
        overflowY,
      }}
    />
  )
}
