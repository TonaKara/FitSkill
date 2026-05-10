import type { NotificationRow } from "@/lib/transaction-notifications"

export const NOTIFICATION_TYPE_ANNOUNCEMENT = "announcement" as const

/**
 * 運営通知の表示用に、文頭の「商品名：」「商品：」等の冗長ラベルを除く（DB 値は変更しない）。
 */
export function sanitizeAdminNotificationDisplayText(raw: string | null | undefined): string {
  const s = (raw ?? "").trim()
  if (!s) {
    return ""
  }
  const normalized = s.normalize("NFKC")
  return normalized
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^(商品名|商品|スキル名|スキル)\s*[：:]\s*/i, "").trimEnd(),
    )
    .join("\n")
    .trim()
}

/**
 * `content` 先頭に、別カラムと同じ件名・理由がテンプレートで重複している場合は除く（レガシー・他経路の結合対策）。
 */
function stripLeadingDuplicateAdminPreamble(
  content: string,
  title: string | null | undefined,
  reason: string | null | undefined,
): string {
  const t = sanitizeAdminNotificationDisplayText(title)
  const r = sanitizeAdminNotificationDisplayText(reason)
  if (!content.trim()) {
    return content
  }
  const lines = content.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const lineNorm = sanitizeAdminNotificationDisplayText(lines[i])
    if (lineNorm === "") {
      i++
      continue
    }
    if (t && lineNorm === t) {
      i++
      continue
    }
    if (r && lineNorm === r) {
      i++
      continue
    }
    break
  }
  return lines.slice(i).join("\n").trim()
}

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
    const t = sanitizeAdminNotificationDisplayText(n.title)
    if (t) {
      return truncateSubject(t, 120)
    }
    return "運営よりお知らせ"
  }
  const fromTitle = sanitizeAdminNotificationDisplayText(n.title)
  if (fromTitle) {
    return truncateSubject(fromTitle, 100)
  }
  return "運営からの連絡"
}

function adminOpsCategoryBracketLabel(n: NotificationRow): string {
  const r = sanitizeAdminNotificationDisplayText(n.reason)
  if (r) {
    if (/^transaction_id:/i.test(r)) {
      return "取引・チャット"
    }
    return r
  }
  if (n.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    return "お知らせ"
  }
  return TYPE_SUBJECT[n.type ?? ""] ?? "運営からの連絡"
}

/** 運営通知の件名行（DB の title を優先、なければ種別に応じた既定文言）。 */
function getAdminOpsHeadlineSubject(n: NotificationRow): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n)
  }
  if (n?.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    return sanitizeAdminNotificationDisplayText(n.title) || "運営よりお知らせ"
  }
  const fromTitle = sanitizeAdminNotificationDisplayText(n.title)
  if (fromTitle) {
    return fromTitle
  }
  return TYPE_SUBJECT[n.type ?? ""] ?? "運営からの連絡"
}

/**
 * 運営タブ・アコーディオン見出し用タイトル（2行）。
 * 1行目: 【カテゴリ（理由）】、2行目: 件名。
 */
export function getAdminOpsAccordionTitle(n: NotificationRow): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n)
  }
  const category = adminOpsCategoryBracketLabel(n)
  const headline = getAdminOpsHeadlineSubject(n)
  return `【${category}】\n${headline}`
}

/**
 * 運営タブ・アコーディオン展開部の本文（`content` のみ）。
 */
export function getAdminOpsAccordionContent(n: NotificationRow): string {
  if (!n?.is_admin_origin) {
    const c = sanitizeAdminNotificationDisplayText(n?.content)
    return c.length > 0 ? c : "（内容なし）"
  }
  const c = stripLeadingDuplicateAdminPreamble(
    sanitizeAdminNotificationDisplayText(n?.content),
    n.title,
    n.reason,
  )
  return c.length > 0 ? c : "（内容なし）"
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
