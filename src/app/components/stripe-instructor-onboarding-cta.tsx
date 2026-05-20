"use client"

import { useCallback, useMemo, useState } from "react"
import { Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getStripeOnboardingUrl,
} from "@/actions/stripe"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatStripeOnboardingUrlErrorForUser } from "@/lib/stripe-payout-error-notice"
import { useTranslations } from "@/lib/i18n/useI18n"
import type { AppNotice } from "@/lib/notifications"

type StripeInstructorOnboardingCtaProps = {
  disabled?: boolean
  onNotice: (notice: AppNotice) => void
  className?: string
}

export function StripeInstructorOnboardingCta({
  disabled = false,
  onNotice,
  className,
}: StripeInstructorOnboardingCtaProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("stripeInstructorOnboarding")
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const resolveStripeAccessToken = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return null
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token?.trim() || null
  }, [supabase])

  const handleOpenConfirm = useCallback(() => {
    if (busy || disabled) {
      return
    }
    setShowConfirm(true)
  }, [busy, disabled])

  const handleCloseConfirm = useCallback(() => {
    if (busy) {
      return
    }
    setShowConfirm(false)
  }, [busy])

  const handleStripeLinkOpen = useCallback(async () => {
    setBusy(true)
    try {
      const accessToken = await resolveStripeAccessToken()
      if (!accessToken) {
        setBusy(false)
        onNotice({
          variant: "error",
          message: formatStripeOnboardingUrlErrorForUser(
            "not_authenticated",
            t("openFailedFallback"),
          ),
        })
        return
      }
      const result = await getStripeOnboardingUrl(true, accessToken)
      if (!result.ok) {
        setBusy(false)
        onNotice({
          variant: "error",
          message: formatStripeOnboardingUrlErrorForUser(
            result.error,
            t("openFailedFallback"),
          ),
        })
        return
      }
      setShowConfirm(false)
      window.location.assign(result.url)
    } catch (err) {
      setBusy(false)
      const raw = err instanceof Error ? err.message : String(err)
      onNotice({
        variant: "error",
        message: formatStripeOnboardingUrlErrorForUser(
          raw,
          t("openFailedFallback"),
        ),
      })
    }
  }, [onNotice, resolveStripeAccessToken, t])

  return (
    <>
      <div className={className}>
        <Button
          type="button"
          className="h-auto min-h-10 w-full whitespace-normal bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
          disabled={busy || disabled}
          onClick={handleOpenConfirm}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {t("issuing")}
            </>
          ) : (
            t("startRegistration")
          )}
        </Button>
      </div>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          role="presentation"
          onClick={handleCloseConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-onboarding-confirm-title"
            className="w-full max-w-xl rounded-2xl border border-border bg-background p-5 shadow-2xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="stripe-onboarding-confirm-title" className="text-lg font-bold text-foreground">
              {t("confirmTitle")}
            </h2>

            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("defaultsLead")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{t("defaults.country")}</li>
                <li>{t("defaults.businessType")}</li>
                <li>{t("defaults.industry")}</li>
                <li>{t("defaults.url")}</li>
                <li>{t("defaults.description")}</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-primary-readable" aria-hidden />
                {t("notesHeading")}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                <li>{t("notes.editable")}</li>
                <li>{t("notes.privacy")}</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseConfirm}
                disabled={busy}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                className="bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                onClick={() => void handleStripeLinkOpen()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t("proceeding")}
                  </>
                ) : (
                  t("agreeProceed")
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? (
        <div
          className="fixed inset-0 z-[10002] flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 shrink-0 animate-spin text-primary" aria-hidden />
          <div className="max-w-md space-y-2">
            <p className="text-base font-bold text-foreground">{t("loadingTitle")}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("loadingBody")}
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
