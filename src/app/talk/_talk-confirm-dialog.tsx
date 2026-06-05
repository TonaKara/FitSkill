"use client"

import { useEffect } from "react"

type TalkConfirmDialogProps = {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** ブラウザの `confirm()` の代わり（「今後表示しない」チェックが出ない） */
export function TalkConfirmDialog({
  message,
  confirmLabel = "OK",
  onConfirm,
  onCancel,
}: TalkConfirmDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="talk-confirm-message"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <p
          id="talk-confirm-message"
          className="text-center text-sm leading-relaxed text-black"
        >
          {message}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-300 px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
