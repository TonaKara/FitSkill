"use client"

import { FormEvent, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"

/** DB に保存される値は日本語固定（既存データとの互換のため）。表示のみ locale で切り替える。 */
const USER_REPORT_REASON_OPTIONS = [
  { value: "不適切な名前", labelKey: "inappropriateName" },
  { value: "規約違反", labelKey: "termsViolation" },
  { value: "その他", labelKey: "other" },
] as const

const PRODUCT_REPORT_REASON_OPTIONS = [
  { value: "不適切な表現・内容", labelKey: "inappropriateContent" },
  { value: "規約違反", labelKey: "termsViolation" },
  { value: "その他", labelKey: "other" },
] as const

type ReportModalProps = {
  open: boolean
  onClose: () => void
  type: "user" | "product"
  targetId: string | number
  onSuccess?: (message: string) => void
}

export function ReportModal({ open, onClose, type, targetId, onSuccess }: ReportModalProps) {
  const t = useTranslations("reportModal")
  const tReasons = useTranslations("reportModal.reasons")
  const tAria = useTranslations("aria")
  const reasonOptions = useMemo(
    () => (type === "user" ? USER_REPORT_REASON_OPTIONS : PRODUCT_REPORT_REASON_OPTIONS),
    [type],
  )
  const [reason, setReason] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!open) {
    return null
  }

  const resetForm = () => {
    setReason("")
    setContent("")
    setErrorMessage(null)
  }

  const handleClose = () => {
    if (isSubmitting) {
      return
    }
    resetForm()
    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    const trimmedContent = content.trim()
    if (!reason) {
      setErrorMessage(t("errors.reasonRequired"))
      return
    }
    if (!trimmedContent) {
      setErrorMessage(t("errors.contentRequired"))
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          targetId,
          reason,
          content: trimmedContent,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? t("errors.submitFailedFallback"))
      }

      resetForm()
      onSuccess?.(t("success"))
      onClose()
    } catch {
      setErrorMessage(t("errors.submitFailed"))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t("title")}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label={tAria("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-200" htmlFor="report-reason">
              {t("reasonLabel")}
            </label>
            <select
              id="report-reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">{t("selectPlaceholder")}</option>
              {reasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {tReasons(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-200" htmlFor="report-content">
              {t("contentLabel")}
            </label>
            <textarea
              id="report-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              placeholder={t("contentPlaceholder")}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 text-white hover:bg-red-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
