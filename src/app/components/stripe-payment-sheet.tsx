"use client"

import { useEffect, useRef, useState } from "react"
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type StripePaymentSheetProps = {
  open: boolean
  onClose: () => void
  clientSecret: string
  publishableKey: string
  returnUrl: string
  onPaid: () => void
}

export function StripePaymentSheet({
  open,
  onClose,
  clientSecret,
  publishableKey,
  returnUrl,
  onPaid,
}: StripePaymentSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<Stripe | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const paymentUnmountRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !clientSecret.trim() || !publishableKey.trim()) {
      return
    }

    const mountEl = containerRef.current
    if (!mountEl) {
      return
    }

    let cancelled = false
    setErrorMessage(null)
    setReady(false)

    void (async () => {
      try {
        const stripe = await loadStripe(publishableKey)
        if (cancelled || !stripe) {
          if (!cancelled) {
            setErrorMessage("Stripe の読み込みに失敗しました。")
          }
          return
        }
        stripeRef.current = stripe
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#C62828",
              borderRadius: "8px",
            },
          },
        })
        elementsRef.current = elements
        const paymentElement = elements.create("payment")
        paymentElement.mount(mountEl)
        paymentUnmountRef.current = () => {
          try {
            paymentElement.unmount()
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) {
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("決済フォームの初期化に失敗しました。")
        }
      }
    })()

    return () => {
      cancelled = true
      setReady(false)
      paymentUnmountRef.current?.()
      paymentUnmountRef.current = null
      elementsRef.current = null
      stripeRef.current = null
    }
  }, [open, clientSecret, publishableKey])

  const handleConfirm = async () => {
    const stripe = stripeRef.current
    const elements = elementsRef.current
    if (!stripe || !elements) {
      return
    }
    setBusy(true)
    setErrorMessage(null)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    })
    setBusy(false)
    if (error) {
      setErrorMessage("決済を完了できませんでした。時間を置いて再度お試しください。")
      return
    }
    onPaid()
  }

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[10001] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
      role="presentation"
      onClick={() => {
        if (!busy) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-payment-title"
        className="my-auto w-full max-w-md shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="stripe-payment-title" className="text-base font-semibold text-zinc-100">
            お支払い
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            onClick={() => {
              if (!busy) {
                onClose()
              }
            }}
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">表示された方法でお支払いください。</p>

        <div ref={containerRef} className="mt-4 min-h-[200px]" />

        {errorMessage ? <p className="mt-3 text-sm text-red-400">{errorMessage}</p> : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-zinc-600 bg-transparent text-zinc-200"
            disabled={busy}
            onClick={() => {
              if (!busy) {
                onClose()
              }
            }}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-500"
            disabled={!ready || busy}
            onClick={() => void handleConfirm()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                処理中...
              </>
            ) : (
              "支払う"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
