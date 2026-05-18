"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Loader2, X } from "lucide-react"
import { DisputeEvidenceImage } from "@/components/DisputeEvidenceImage"
import { Button } from "@/components/ui/button"
import { adminUi } from "@/lib/admin-ui"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DetailModalProps = {
  open: boolean
  tableName:
    | "profiles"
    | "skills"
    | "user_reports"
    | "product_reports"
    | "admin_reported_users_summary"
    | "contact_submissions"
    | "transactions"
    | "cms_pages"
    | "settings"
  item: Record<string, unknown> | null
  onClose: () => void
  onStatusChange: (nextStatus: "pending" | "investigating" | "resolved") => Promise<void>
  statusUpdating: boolean
}

const STATUS_OPTIONS = [
  { value: "pending", label: "未対応" },
  { value: "investigating", label: "調査中" },
  { value: "resolved", label: "対応済み" },
] as const

export function DetailModal({
  open,
  tableName,
  item,
  onClose,
  onStatusChange,
  statusUpdating,
}: DetailModalProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentSecurityBlocked, setAttachmentSecurityBlocked] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!open || !item || tableName !== "contact_submissions") {
      setAttachmentUrl(null)
      setAttachmentSecurityBlocked(false)
      return () => {
        cancelled = true
      }
    }

    const resolveImage = async () => {
      const attachmentPath = item.attachment_path
      if (typeof attachmentPath !== "string" || attachmentPath.length === 0) {
        if (!cancelled) {
          setAttachmentUrl(null)
          setAttachmentSecurityBlocked(false)
        }
        return
      }

      const { data, error } = await supabase.storage
        .from("contact-attachments")
        .createSignedUrl(attachmentPath, 60)
      if (error) {
        if (!cancelled) {
          setAttachmentUrl(null)
          setAttachmentSecurityBlocked(true)
        }
        console.error("【重要】Supabaseエラー詳細:", error)
        return
      }
      const imageUrl = data?.signedUrl ?? null
      if (!imageUrl) {
        if (!cancelled) {
          setAttachmentUrl(null)
          setAttachmentSecurityBlocked(true)
        }
        return
      }

      if (!cancelled) {
        setAttachmentUrl(imageUrl)
        setAttachmentSecurityBlocked(false)
      }
    }

    void resolveImage()
    return () => {
      cancelled = true
    }
  }, [open, item, supabase, tableName])

  if (!open || !item) {
    return null
  }

  const currentStatus = typeof item.status === "string" ? item.status : ""
  const canUpdateStatus =
    (tableName === "user_reports" ||
      tableName === "product_reports" ||
      tableName === "contact_submissions") &&
    currentStatus.length > 0

  const handleStatusSelect = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as "pending" | "investigating" | "resolved"
    if (!value || value === currentStatus) {
      return
    }
    setStatusError(null)
    try {
      await onStatusChange(value)
    } catch {
      setStatusError("ステータス更新に失敗しました。")
    }
  }

  const renderContactDetail = () => {
    const profileIdRaw = item.submitter_profile_id
    const profileId =
      typeof profileIdRaw === "string" && profileIdRaw.trim().length > 0 ? profileIdRaw.trim() : null
    return (
      <div className="space-y-3 text-sm">
        <p>
          <span className="text-muted-foreground">名前:</span> {String(item.name ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">メール:</span> {String(item.email ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">カテゴリ:</span> {String(item.category ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">件名:</span> {String(item.subject ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">取引ID:</span> {String(item.transaction_id ?? "—")}
        </p>
        <p>
          <span className="text-muted-foreground">送信者プロフィール:</span>{" "}
          {profileId ? (
            <Link href={`/store/${encodeURIComponent(profileId)}`} className="text-red-400 underline hover:text-red-300">
              {profileId}
            </Link>
          ) : (
            <span className="text-muted-foreground">未ログインの送信</span>
          )}
        </p>
        <p>
          <span className="text-muted-foreground">内容:</span> {String(item.content ?? "—")}
        </p>
        <div>
          <p className="mb-1 text-muted-foreground">添付画像:</p>
          {attachmentUrl ? (
            <div className="h-56 w-full overflow-hidden rounded-lg border border-border bg-muted p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- 管理画面の添付画像表示 */}
              <img src={attachmentUrl} alt="添付画像" className="h-full w-full object-contain" />
            </div>
          ) : attachmentSecurityBlocked ? (
            <p className="text-amber-700 dark:text-amber-300">セキュリティ上の理由により画像を表示できません</p>
          ) : (
            <p className="text-muted-foreground">画像はありません</p>
          )}
        </div>
      </div>
    )
  }

  const renderTransactionDisputeDetail = () => {
    const detail =
      typeof item.disputed_reason_detail === "string" && item.disputed_reason_detail.length > 0
        ? item.disputed_reason_detail
        : "—"
    const evidencePathOrUrl =
      typeof item.disputed_evidence_url === "string" && item.disputed_evidence_url.trim().length > 0
        ? item.disputed_evidence_url
        : null

    return (
      <div className="space-y-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">詳細（申立人入力）</p>
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted p-3 text-foreground">
            {detail}
          </p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">証拠画像</p>
          {evidencePathOrUrl ? (
            <DisputeEvidenceImage pathOrUrl={evidencePathOrUrl} alt="異議申し立ての証拠画像" />
          ) : (
            <p className="text-muted-foreground">証拠画像はありません</p>
          )}
        </div>
      </div>
    )
  }

  const renderReportDetail = () => {
    const targetLabel = tableName === "user_reports" ? "対象ユーザーID" : "対象商品ID"
    const targetValue = tableName === "user_reports" ? item.reported_user_id : item.product_id
    return (
      <div className="space-y-3 text-sm">
        <p><span className="text-muted-foreground">通報理由:</span> {String(item.reason ?? "—")}</p>
        <p><span className="text-muted-foreground">内容:</span> {String(item.content ?? "—")}</p>
        <p><span className="text-muted-foreground">{targetLabel}:</span> {String(targetValue ?? "—")}</p>
      </div>
    )
  }

  return (
    <div className={cn(adminUi.modalOverlay, "px-4")}>
      <div className={adminUi.modal}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">詳細</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {tableName === "contact_submissions"
            ? renderContactDetail()
            : tableName === "user_reports" || tableName === "product_reports"
              ? renderReportDetail()
              : tableName === "transactions"
                ? renderTransactionDisputeDetail()
              : (
                <div className="space-y-2 text-sm">
                  {(tableName === "skills"
                    ? Object.entries(item).filter(([key]) => key !== "is_admin")
                    : Object.entries(item)
                  ).map(([key, value]) => (
                    <p key={key}>
                      <span className="text-muted-foreground">{key}:</span> {value == null ? "—" : String(value)}
                    </p>
                  ))}
                </div>
              )}

          {canUpdateStatus ? (
            <div className="rounded-lg border border-border bg-muted p-3">
              <label htmlFor="admin-status-select" className={cn("mb-1 block", adminUi.labelSection)}>
                ステータス変更
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="admin-status-select"
                  value={currentStatus}
                  onChange={(event) => void handleStatusSelect(event)}
                  disabled={statusUpdating}
                  className={cn("h-9 px-2 text-sm focus:ring-red-500", adminUi.select)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {statusUpdating ? <Loader2 className="h-4 w-4 animate-spin text-red-400" /> : null}
              </div>
              {statusError ? <p className="mt-2 text-xs text-red-400">{statusError}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className={adminUi.btnOutline}
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  )
}
