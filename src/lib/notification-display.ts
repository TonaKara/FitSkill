import type { NotificationRow } from "@/lib/transaction-notifications"

export const NOTIFICATION_TYPE_ANNOUNCEMENT = "announcement" as const

/** `reason` 欄の `transaction_id:<uuid>` から取引ID（チャット遷移用） */
export function parseTransactionIdFromNotificationReason(reason: string | null | undefined): string | null {
  const t = (reason ?? "").trim()
  if (!t) {
    return null
  }
  const m = /^transaction_id:([0-9a-fA-F-]+)$/.exec(t)
  const id = m?.[1]?.trim() ?? ""
  return id.length > 0 ? id : null
}

const TYPE_SUBJECT: Record<string, string> = {
  purchase: "取引の開始",
  message: "新着メッセージ",
  completion_request: "完了承認の依頼",
  completion_approved: "取引完了",
  review: "レビュー",
  dispute: "異議申し立て",
  consultation_request: "事前オファー申込",
  consultation_accepted: "事前オファー承認",
  consultation_rejected: "事前オファー見送り",
  [NOTIFICATION_TYPE_ANNOUNCEMENT]: "お知らせ",
}

/**
 * 一般タブ用: `is_admin_origin === false` のみ想定。
 */
export function getGeneralNotificationListSubject(n: NotificationRow): string {
  const byType = TYPE_SUBJECT[n?.type ?? ""]
  if (byType) {
    return byType
  }
  return "通知"
}

function truncateSubject(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) {
    return t
  }
  return `${t.slice(0, max - 1)}…`
}

/**
 * 運営タブ: 件名。
 * お知らせ（`type === 'announcement'`）は `title` を優先して表示。
 * それ以外の運営通知は先頭の非「理由：」行。
 */
export function getAdminOpsListSubject(n: NotificationRow): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n)
  }
  if (n?.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    const t = n.title?.trim()
    if (t) {
      return truncateSubject(t, 120)
    }
    return "運営よりお知らせ"
  }
  const fromTitle = n?.title?.trim()
  if (fromTitle) {
    return truncateSubject(fromTitle, 100)
  }
  return "運営からの連絡"
}

/**
 * 運営タブ: 本文（DB の `content` をそのまま使用）。
 */
export function getAdminOpsListBody(n: NotificationRow): string {
  return n?.content?.trim() || "（本文なし）"
}

/**
 * 運営タブ: 理由（`reason` が null/空なら表示しない）。
 */
export function getAdminOpsListReason(n: NotificationRow): string | null {
  if (!n?.is_admin_origin) {
    return null
  }
  const r = n?.reason?.trim() ?? ""
  if (!r) {
    return null
  }
  return r
}

/**
 * 一般タブ用「詳細」ラベル（運営タブでは使わない想定）。
 */
export function getNotificationBodySectionLabel(n: NotificationRow): string | null {
  if (n?.is_admin_origin) {
    return null
  }
  return "詳細"
}
