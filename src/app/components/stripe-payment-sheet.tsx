"use client"

import { useEffect, useRef, useState } from "react"
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"

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
  const t = useTranslations("stripePaymentSheet")
  const tAria = useTranslations("aria")
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
            setErrorMessage(t("errors.stripeLoadFailed"))
          }
          return
        }
        stripeRef.current = stripe
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#E64A19",
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
          setErrorMessage(t("errors.elementsInitFailed"))
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
  }, [open, clientSecret, publishableKey, t])

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
      setErrorMessage(t("errors.paymentFailed"))
      return
    }
    onPaid()
  }

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[10001] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
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
        className="my-auto w-full max-w-md shrink-0 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="stripe-payment-title" className="text-base font-semibold text-foreground">
            {t("title")}
          </h2>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => {
              if (!busy) {
                onClose()
              }
            }}
            aria-label={tAria("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>

        <div ref={containerRef} className="mt-4 min-h-[200px]" />

        {errorMessage ? <p className="mt-3 text-sm text-red-400">{errorMessage}</p> : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-border bg-background text-foreground"
            disabled={busy}
            onClick={() => {
              if (!busy) {
                onClose()
              }
            }}
          >
            {t("cancel")}
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
                {t("processing")}
              </>
            ) : (
              t("pay")
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
