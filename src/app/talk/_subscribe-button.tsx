"use client"

import { useCallback, useEffect, useId, useState } from "react"
import { TALK_STRIPE_LINKS } from "@/talk/_stripe-links"

/**
 * GritVib の Stripe Payment Link へ進む前に、ログイン中メールでの決済を促す確認ダイアログ付き CTA。
 */
export function GritvibSubscribeButton({
  accountEmail,
  className,
  label = "有効にする",
  disabled = false,
  disabledTitle = "現在、満員のため新規のご参加は一時停止しています。",
}: {
  accountEmail: string
  className?: string
  label?: string
  /** 満員などで決済へ進めないとき */
  disabled?: boolean
  disabledTitle?: string
}) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const trimmedEmail = accountEmail.trim()

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [close, open])

  const proceedToCheckout = () => {
    close()
    window.open(TALK_STRIPE_LINKS.subscription, "_blank", "noopener,noreferrer")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        aria-disabled={disabled}
        className={
          className ??
          "inline-flex h-8 items-center justify-center rounded-full bg-black px-4 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:hover:bg-zinc-300"
        }
      >
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 py-6 sm:items-center"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-left text-black shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-medium tracking-tight">
              お支払い前の確認
            </h2>
            <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-zinc-700">
              お支払い画面では、メールアドレス欄に
              <strong className="font-medium text-black"> 必ずログイン中のアカウントと同じアドレス </strong>
              を入力してください。別のメールアドレスでお支払いいただくと、チャットを利用できない場合がございます。
            </p>
            {trimmedEmail ? (
              <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center text-sm font-medium text-black">
                {trimmedEmail}
              </p>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                ログイン中のアカウントのメールアドレスをご利用ください。
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 bg-white px-5 text-sm font-medium text-black transition-colors hover:bg-zinc-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={proceedToCheckout}
                className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
