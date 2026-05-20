"use client"

import { useEffect, useState } from "react"
import { Loader2, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { chatUi } from "@/lib/chat-ui"
import { useTranslations } from "@/lib/i18n/useI18n"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { submitTransactionReview, type TransactionReviewRow } from "@/lib/transaction-reviews"
import { cn } from "@/lib/utils"

type TransactionReviewCardProps = {
  transactionId: string
  userId: string
  revieweeId: string
  peerNoun: string
  initialReview: TransactionReviewRow | null
  reviewLoading: boolean
  onReviewSaved: (row: TransactionReviewRow) => void
  onError: (message: string) => void
}

export function TransactionReviewCard({
  transactionId,
  userId,
  revieweeId,
  peerNoun,
  initialReview,
  reviewLoading,
  onReviewSaved,
  onError,
}: TransactionReviewCardProps) {
  const supabase = getSupabaseBrowserClient()
  const t = useTranslations("transactionReview")
  const tModal = useTranslations("transactionReview.modal")
  const tAria = useTranslations("aria")
  const [modalOpen, setModalOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [localReview, setLocalReview] = useState<TransactionReviewRow | null>(initialReview)

  useEffect(() => {
    setLocalReview(initialReview)
  }, [initialReview])

  useEffect(() => {
    if (modalOpen && !localReview) {
      setStars(5)
      setComment("")
    }
  }, [modalOpen, localReview])

  const hasReview = localReview != null
  const displayLine = hasReview
    ? t("doneTemplate", {
        stars: String(localReview.stars),
        commentSuffix: localReview.comment?.trim()
          ? `${t("commentSeparator")}${localReview.comment.trim()}`
          : "",
      })
    : null

  const handleSubmit = async () => {
    const s = stars >= 1 && stars <= 5 ? stars : 0
    if (s < 1) {
      onError(t("errors.selectStars"))
      return
    }
    setSubmitting(true)
    try {
      const { data, error } = await submitTransactionReview(supabase, {
        transactionId,
        reviewerId: userId,
        revieweeId,
        stars: s,
        comment: comment.trim() || null,
      })
      if (error || !data) {
        // 既存ロジック保持: バックエンドは日本語固定メッセージで重複を返す
        const dupMsgJa = "この取引にはすでに評価を送信済みです。"
        const msg = error?.message?.trim() ?? ""
        onError(
          msg === dupMsgJa
            ? t("errors.duplicate")
            : t("errors.submitFailed"),
        )
        return
      }
      setLocalReview(data)
      onReviewSaved(data)
      setModalOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (reviewLoading) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 px-4 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" aria-hidden />
        {t("loadingState")}
      </div>
    )
  }

  return (
    <>
      <div className="w-full max-w-md rounded-2xl border border-emerald-600/35 bg-emerald-50 px-4 py-3 text-center shadow-sm md:max-w-2xl dark:border-emerald-700/35 dark:bg-emerald-950/25">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100/95">
          {t("completedNotice", { peerNoun })}
        </p>
        {hasReview && displayLine ? (
          <p className="mt-2 break-words text-left text-sm leading-relaxed text-foreground">{displayLine}</p>
        ) : null}
        {!hasReview ? (
          <div className="mt-3">
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => setModalOpen(true)}
            >
              {t("rateButton")}
            </Button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 px-4"
          onClick={() => (submitting ? null : setModalOpen(false))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-review-title"
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl md:max-w-2xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="tx-review-title" className="text-lg font-bold text-foreground">
                {tModal("title", { peerNoun })}
              </h2>
              <button
                type="button"
                onClick={() => (submitting ? null : setModalOpen(false))}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={tAria("close")}
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{tModal("description")}</p>
            <div className="mb-3 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={submitting}
                  onClick={() => setStars(n)}
                  className="rounded p-0.5 text-amber-400 transition hover:scale-110"
                  aria-label={tModal("starAria", { n: String(n) })}
                >
                  <Star
                    className={cn(
                      "h-8 w-8",
                      n <= stars ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/50",
                    )}
                    strokeWidth={1.2}
                  />
                </button>
              ))}
            </div>
            <p className="mb-2 text-center text-sm text-muted-foreground">
              {stars > 0 ? tModal("starsScore", { stars: String(stars) }) : tModal("starsUnselected")}
            </p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tModal("commentPlaceholder")}
              className={cn(chatUi.textarea, "mb-4 w-full min-h-[88px] md:min-h-[140px]")}
              maxLength={2000}
              disabled={submitting}
              rows={4}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className={chatUi.modalCancel}
                onClick={() => (submitting ? null : setModalOpen(false))}
                disabled={submitting}
              >
                {tModal("cancel")}
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : tModal("submit")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
