"use client"

import { useEffect, useState } from "react"
import { Loader2, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { submitTransactionReview, type TransactionReviewRow } from "@/lib/transaction-reviews"
import { cn } from "@/lib/utils"

type TransactionReviewCardProps = {
  transactionId: string
  userId: string
  revieweeId: string
  peerNoun: "出品者" | "購入者"
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
    ? `評価済み：星${localReview.stars}${
        localReview.comment?.trim() ? ` — ${localReview.comment.trim()}` : ""
      }`
    : null

  const handleSubmit = async () => {
    const s = stars >= 1 && stars <= 5 ? stars : 0
    if (s < 1) {
      onError("星を1〜5で選んでください。")
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
        const dupMsg = "この取引にはすでに評価を送信済みです。"
        const msg = error?.message?.trim() ?? ""
        onError(
          msg === dupMsg
            ? dupMsg
            : "評価の送信に失敗しました。時間を置いて再度お試しください。",
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
      <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/50 px-4 py-4 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" aria-hidden />
        評価の状態を確認しています…
      </div>
    )
  }

  return (
    <>
      <div className="w-full max-w-md rounded-2xl border border-emerald-700/35 bg-emerald-950/25 px-4 py-3 text-center shadow-sm">
        <p className="text-sm font-medium text-emerald-100/95">
          取引が終了しました。{peerNoun}を評価してください。
        </p>
        {hasReview && displayLine ? (
          <p className="mt-2 break-words text-left text-sm leading-relaxed text-zinc-200">{displayLine}</p>
        ) : null}
        {!hasReview ? (
          <div className="mt-3">
            <Button
              type="button"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => setModalOpen(true)}
            >
              評価する
            </Button>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/80 px-4"
          onClick={() => (submitting ? null : setModalOpen(false))}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tx-review-title"
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-600 bg-zinc-950 p-5 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 id="tx-review-title" className="text-lg font-bold text-white">
                {peerNoun}を評価
              </h2>
              <button
                type="button"
                onClick={() => (submitting ? null : setModalOpen(false))}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="閉じる"
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-sm text-zinc-400">5段階の星とコメント（任意）を入力できます。</p>
            <div className="mb-3 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={submitting}
                  onClick={() => setStars(n)}
                  className="rounded p-0.5 text-amber-400 transition hover:scale-110"
                  aria-label={`${n}点`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8",
                      n <= stars ? "fill-amber-400 text-amber-400" : "fill-zinc-800 text-zinc-600",
                    )}
                    strokeWidth={1.2}
                  />
                </button>
              ))}
            </div>
            <p className="mb-2 text-center text-sm text-zinc-500">{stars > 0 ? `${stars} / 5` : "未選択"}</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="コメント（任意）"
              className="mb-4 min-h-[88px] w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
              maxLength={2000}
              disabled={submitting}
              rows={4}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-900"
                onClick={() => (submitting ? null : setModalOpen(false))}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "送信"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
