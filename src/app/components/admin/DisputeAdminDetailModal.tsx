"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, X } from "lucide-react"
import { DisputeEvidenceImage } from "@/components/DisputeEvidenceImage"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createAdminOriginNotification, sendAdminNotification } from "@/lib/transaction-notifications"
import { completeTransactionWithPayout } from "@/actions/payout"

const ADMIN_REASON_OPTIONS = [
  "利用規約違反",
  "不適切な画像",
  "スパム行為",
  "虚偽または誤解を招く内容",
  "権利侵害の可能性",
  "運営判断",
] as const

export type DisputeAdminDetailModalProps = {
  open: boolean
  item: Record<string, unknown> | null
  onClose: () => void
  /** 承認・棄却・BAN 成功後に一覧を再取得する */
  onAfterMutation: () => void
  onNotify: (message: string, variant: "success" | "error") => void
}

export function DisputeAdminDetailModal({
  open,
  item,
  onClose,
  onAfterMutation,
  onNotify,
}: DisputeAdminDetailModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [sellerProfileStatus, setSellerProfileStatus] = useState<string | null>(null)
  const [buyerProfileStatus, setBuyerProfileStatus] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [adminReason, setAdminReason] = useState("")

  const transactionId = item ? String(item.id ?? "") : ""
  const sellerId = item ? String(item.seller_id ?? "") : ""
  const buyerId = item ? String(item.buyer_id ?? "") : ""
  const txStatus = item ? String(item.status ?? "") : ""
  const disputeStatusRaw = item ? (item.dispute_status as string | null | undefined) : undefined
  const disputeStatus = disputeStatusRaw ?? null

  const isDisputeActionable =
    txStatus === "disputed" && (disputeStatus === "open" || disputeStatus === null || disputeStatus === "")

  const loadProfiles = useCallback(async () => {
    if (!sellerId && !buyerId) {
      setSellerProfileStatus(null)
      setBuyerProfileStatus(null)
      return
    }
    const ids = [sellerId, buyerId].filter((id) => id.length > 0)
    const { data, error } = await supabase.from("profiles").select("id, status").in("id", ids)
    if (error) {
      console.error("[DisputeAdminDetailModal] profiles load", error)
      setSellerProfileStatus(null)
      setBuyerProfileStatus(null)
      return
    }
    const map: Record<string, string> = {}
    for (const row of (data ?? []) as Array<{ id: string; status: string | null }>) {
      map[row.id] = row.status ?? ""
    }
    setSellerProfileStatus(sellerId ? (map[sellerId] ?? null) : null)
    setBuyerProfileStatus(buyerId ? (map[buyerId] ?? null) : null)
  }, [buyerId, sellerId, supabase])

  useEffect(() => {
    if (!open || !item || !transactionId) {
      setSellerProfileStatus(null)
      setBuyerProfileStatus(null)
      setAdminReason("")
      return
    }
    void loadProfiles()
  }, [open, item, transactionId, loadProfiles])

  const handleBan = async (targetId: string, label: string) => {
    if (!targetId || actionBusy) {
      return
    }
    const current = targetId === sellerId ? sellerProfileStatus : buyerId === targetId ? buyerProfileStatus : null
    if (current === "banned") {
      onNotify(`${label}は既にBAN済みです。`, "error")
      return
    }
    if (!adminReason.trim()) {
      onNotify("理由を選択してください。", "error")
      return
    }
    if (!window.confirm(`${label}をBANしますか？この操作は取り消せません。`)) {
      return
    }
    setActionBusy(true)
    try {
      const { error } = await supabase.from("profiles").update({ status: "banned" }).eq("id", targetId)
      if (error) {
        console.error("[DisputeAdminDetailModal] ban failed", error)
        onNotify("BANの更新に失敗しました。", "error")
        return
      }
      onNotify(`${label}をBANしました。`, "success")
      await createAdminOriginNotification(supabase, {
        recipient_id: targetId,
        type: "admin_user_status",
        content: `運営対応: ${label}をBANしました。理由: ${adminReason}`,
      })
      await loadProfiles()
      onAfterMutation()
    } finally {
      setActionBusy(false)
    }
  }

  const handleApproveDispute = async () => {
    if (!transactionId || !isDisputeActionable || actionBusy) {
      return
    }
    if (!adminReason.trim()) {
      onNotify("理由を選択してください。", "error")
      return
    }
    if (!window.confirm("承認（取引再開）を実行しますか？\n取引を差し戻して再開し、出品者と購入者の交渉を継続させます。")) {
      return
    }
    setActionBusy(true)
    try {
      const { data, error } = await supabase
        .from("transactions")
        .update({
          status: "active",
          dispute_status: "resolved",
          completed_at: null,
          auto_complete_at: null,
        })
        .eq("id", transactionId)
        .eq("status", "disputed")
        .select("id")
      if (error) {
        console.error("[DisputeAdminDetailModal] approve refund", error)
        onNotify("承認処理に失敗しました。", "error")
        return
      }
      if (!data?.length) {
        onNotify("対象の取引が見つからないか、すでに更新されています。", "error")
        return
      }
      let notificationFailed = false
      if (sellerId) {
        const { error: sellerNotificationError } = await sendAdminNotification(supabase, {
          title: "異議申し立て承認",
          reason: adminReason,
          content:
            "購入者より不足の連絡があり、異議申し立てが承認されました。現在取引が再開されていますので、不足分の対応をお願いします",
          target_user_id: sellerId,
        })
        if (sellerNotificationError) {
          notificationFailed = true
          console.error("[DisputeAdminDetailModal] seller reopen notification failed", sellerNotificationError)
        }
      }
      if (buyerId) {
        const { error: buyerNotificationError } = await sendAdminNotification(supabase, {
          title: "異議申し立て承認",
          reason: adminReason,
          content:
            "異議申し立てが認められました。取引を再開しますので、出品者と交渉を続けてください",
          target_user_id: buyerId,
        })
        if (buyerNotificationError) {
          notificationFailed = true
          console.error("[DisputeAdminDetailModal] buyer reopen notification failed", buyerNotificationError)
        }
      }
      onNotify(
        notificationFailed
          ? "承認（取引再開）は反映しましたが、一部通知の送信に失敗しました。"
          : "承認（取引再開）を反映し、当事者へ通知しました。",
        notificationFailed ? "error" : "success",
      )
      onClose()
      onAfterMutation()
    } finally {
      setActionBusy(false)
    }
  }

  const handleRejectDispute = async () => {
    if (!transactionId || !isDisputeActionable || actionBusy) {
      return
    }
    if (!adminReason.trim()) {
      onNotify("理由を選択してください。", "error")
      return
    }
    if (!window.confirm("棄却（取引完了）を実行しますか？\n取引を完了にし、申し立てを棄却として記録します。")) {
      return
    }
    setActionBusy(true)
    try {
      await completeTransactionWithPayout(transactionId, "dispute_rejection")
      onNotify("棄却（取引完了）を反映し、出品者へ売上送金（手数料12%控除後）を実行しました。", "success")
      if (sellerId) {
        await createAdminOriginNotification(supabase, {
          recipient_id: sellerId,
          type: "admin_dispute_result",
          content: `運営対応: 異議申し立てを棄却し、取引を完了扱いにしました。理由: ${adminReason}`,
        })
      }
      if (buyerId) {
        await createAdminOriginNotification(supabase, {
          recipient_id: buyerId,
          type: "admin_dispute_result",
          content: `運営対応: 異議申し立てを棄却し、取引を完了扱いにしました。理由: ${adminReason}`,
        })
      }
      onClose()
      onAfterMutation()
    } catch (error) {
      const message = error instanceof Error ? error.message : "棄却処理に失敗しました。"
      console.error("[DisputeAdminDetailModal] reject dispute / payout", error)
      onNotify(message, "error")
    } finally {
      setActionBusy(false)
    }
  }

  if (!open || !item) {
    return null
  }

  const reason = typeof item.disputed_reason === "string" && item.disputed_reason.length > 0 ? item.disputed_reason : "—"
  const detail =
    typeof item.disputed_reason_detail === "string" && item.disputed_reason_detail.length > 0
      ? item.disputed_reason_detail
      : "—"
  const evidencePathOrUrl =
    typeof item.disputed_evidence_url === "string" && item.disputed_evidence_url.trim().length > 0
      ? item.disputed_evidence_url
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">異議申し立ての詳細</h2>
            <p className="mt-0.5 text-xs text-zinc-500">取引ID: {transactionId || "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">チャット</h3>
            <p className="mb-3 text-zinc-400">やりとりの内容はチャット画面で確認できます。</p>
            <Button asChild type="button" variant="outline" size="sm" className="border-zinc-600 bg-zinc-900 text-zinc-100">
              <Link href={`/chat/${transactionId}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                チャット画面を開く
              </Link>
            </Button>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">申し立て内容</h3>
            <p className="mb-2">
              <span className="text-zinc-500">理由:</span> <span className="text-zinc-100">{reason}</span>
            </p>
            <p className="mb-1 text-zinc-500">詳細</p>
            <p className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 text-zinc-100">{detail}</p>
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">証拠画像</p>
              {evidencePathOrUrl ? (
                <DisputeEvidenceImage pathOrUrl={evidencePathOrUrl} alt="異議申し立ての証拠画像" chatThumbnail />
              ) : (
                <p className="text-zinc-500">証拠画像はありません</p>
              )}
            </div>
          </section>

          <section className="border-t border-zinc-800 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">ユーザー対応</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={actionBusy || !sellerId || sellerProfileStatus === "banned"}
                className="bg-red-800 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleBan(sellerId, "出品者")}
              >
                {sellerProfileStatus === "banned" ? "出品者はBAN済み" : "出品者をBAN"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionBusy || !buyerId || buyerProfileStatus === "banned"}
                className="bg-red-800 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => void handleBan(buyerId, "購入者")}
              >
                {buyerProfileStatus === "banned" ? "購入者はBAN済み" : "購入者をBAN"}
              </Button>
            </div>
          </section>
        </div>

        <div className="shrink-0 space-y-3 border-t border-zinc-800 px-5 py-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="admin-dispute-reason">
              理由選択
            </label>
            <div className="flex gap-2">
              <select
                id="admin-dispute-reason"
                value={adminReason}
                onChange={(e) => setAdminReason(e.target.value)}
                className="h-9 w-full rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
              >
                <option value="">理由を選択</option>
                {ADMIN_REASON_OPTIONS.map((reasonOption) => (
                  <option key={reasonOption} value={reasonOption}>
                    {reasonOption}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={() => onNotify(adminReason ? `選択中の理由: ${adminReason}` : "理由を選択してください。", adminReason ? "success" : "error")}
              >
                送信
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              disabled={!isDisputeActionable || actionBusy}
              className="inline-flex items-center gap-2 bg-emerald-700 text-white hover:bg-emerald-600 disabled:opacity-50"
              onClick={() => void handleApproveDispute()}
            >
              {actionBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
              承認（取引再開）
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!isDisputeActionable || actionBusy}
              className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
              onClick={() => void handleRejectDispute()}
            >
              棄却（取引完了）
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
              onClick={onClose}
            >
              閉じる
            </Button>
          </div>
          {!isDisputeActionable ? (
            <p className="text-center text-xs text-zinc-500">
              この取引は異議対応中ではないため、承認・棄却は実行できません。
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
