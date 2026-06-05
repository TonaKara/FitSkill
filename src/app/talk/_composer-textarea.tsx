"use client"

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"
import { syncTextareaAutoGrow } from "@/lib/textarea-auto-grow"

/** この行数までは枠を広げ、超えた分は入力欄内スクロール */
const MAX_ROWS = 5

const baseClassName =
  "box-border block w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-relaxed text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"

export type TalkComposerTextareaProps = {
  value: string
  onChange: (value: string) => void
  /** PC (md 以上): Enter で送信、Shift+Enter で改行 */
  onSubmit?: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
}

export const TalkComposerTextarea = forwardRef<
  HTMLTextAreaElement,
  TalkComposerTextareaProps
>(function TalkComposerTextarea(
  { value, onChange, onSubmit, onKeyDown, disabled, placeholder, maxLength, className },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [heightPx, setHeightPx] = useState<number | undefined>(undefined)
  const [maxHeightPx, setMaxHeightPx] = useState<number | undefined>(undefined)
  const [overflowY, setOverflowY] = useState<"auto" | "hidden">("hidden")

  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

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
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => syncHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [syncHeight])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      const prefersDesktopSend =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches
      if (prefersDesktopSend && onSubmit && !disabled) {
        event.preventDefault()
        onSubmit()
        return
      }
    }
    onKeyDown?.(event)
  }

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
      onInput={syncHeight}
      onKeyDown={handleKeyDown}
      className={cn(baseClassName, className)}
      style={{
        height: heightPx,
        maxHeight: maxHeightPx,
        overflowY,
      }}
    />
  )
})
