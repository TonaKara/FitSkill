"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { syncTextareaAutoGrow } from "@/lib/textarea-auto-grow"

const MAX_ROWS = 6

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
  const [heightPx, setHeightPx] = useState<number | undefined>(undefined)
  const [maxHeightPx, setMaxHeightPx] = useState<number | undefined>(undefined)
  const [overflowY, setOverflowY] = useState<"auto" | "hidden">("hidden")

  const syncHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const next = syncTextareaAutoGrow(el, MAX_ROWS)
    setHeightPx(next.heightPx)
    setMaxHeightPx(next.maxHeightPx)
    setOverflowY(next.overflowY)
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

  return (
    <textarea
      ref={textareaRef}
      id={id}
      rows={1}
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
        maxHeight: maxHeightPx,
        overflowY,
      }}
    />
  )
}
