"use client"

import { FormEvent, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const USER_REPORT_REASON_OPTIONS = ["不適切な名前", "規約違反", "その他"] as const
const PRODUCT_REPORT_REASON_OPTIONS = ["不適切な表現・内容", "規約違反", "その他"] as const

type ReportModalProps = {
  open: boolean
  onClose: () => void
  type: "user" | "product"
  targetId: string | number
  onSuccess?: (message: string) => void
}

export function ReportModal({ open, onClose, type, targetId, onSuccess }: ReportModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const reasonOptions = type === "user" ? USER_REPORT_REASON_OPTIONS : PRODUCT_REPORT_REASON_OPTIONS
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
      setErrorMessage("通報理由を選択してください。")
      return
    }
    if (!trimmedContent) {
      setErrorMessage("詳細内容を入力してください。")
      return
    }

    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      const reporterId = userData.user?.id ?? null
      if (userError || !reporterId) {
        throw new Error("通報にはログインが必要です。")
      }

      const nowIso = new Date().toISOString()
      if (type === "user") {
        const reportedUserId = String(targetId)
        const { error } = await supabase.from("user_reports").insert({
          reporter_id: reporterId,
          reported_user_id: reportedUserId,
          reason,
          content: trimmedContent,
          status: "pending",
          created_at: nowIso,
        })
        if (error) {
          throw error
        }
      } else {
        const productId = Number(targetId)
        if (!Number.isFinite(productId)) {
          throw new Error("商品IDが不正です。")
        }
        const { error } = await supabase.from("product_reports").insert({
          reporter_id: reporterId,
          product_id: productId,
          reason,
          content: trimmedContent,
          status: "pending",
          created_at: nowIso,
        })
        if (error) {
          throw error
        }
      }

      resetForm()
      onSuccess?.("通報を受け付けました")
      onClose()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "通報の送信に失敗しました。時間を置いて再度お試しください。"
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">通報する</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-200" htmlFor="report-reason">
              通報理由
            </label>
            <select
              id="report-reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">選択してください</option>
              {reasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-zinc-200" htmlFor="report-content">
              詳細内容
            </label>
            <textarea
              id="report-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              placeholder="通報内容を入力してください"
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
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-red-600 text-white hover:bg-red-500">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
                </>
              ) : (
                "通報を送信"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
