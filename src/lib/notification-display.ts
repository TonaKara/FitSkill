import type { NotificationRow } from "@/lib/transaction-notifications"

export const NOTIFICATION_TYPE_ANNOUNCEMENT = "announcement" as const

/**
 * 表示用ラベル束。ロケール非依存の純関数として保つため、呼び出し側で
 * `useTranslations` 等から組み立てて渡す。
 */
export type NotificationDisplayLabels = {
  /** 件名種別→表示ラベル（type ベース） */
  subjectByType: Record<string, string>
  /** 種別マップに無い場合の汎用件名 */
  defaultSubject: string
  /** 取引チャットへのリンクが付くカテゴリ表示 */
  adminCategoryTransactionChat: string
  /** announcement のときのカテゴリ既定値 */
  adminCategoryAnnouncement: string
  /** モデレーション通知のカテゴリ別ラベル（type → 短いラベル） */
  adminCategoryBracketByType: Record<string, string>
  /** カテゴリ既定値（フォールバック） */
  adminCategoryDefault: string
  /** announcement の件名フォールバック */
  adminHeadlineAnnouncementFallback: string
  /** 件名フォールバック（汎用） */
  adminHeadlineDefault: string
  /** カテゴリ＝件名のときに使うラベル（例: 「運営」） */
  adminBracketPrefix: string
  /** 本文が空のときの代替表示 */
  emptyContent: string
  /** 一般タブ・詳細セクションのラベル */
  bodySectionLabel: string
  /**
   * 「運営からのお知らせ」の `reason` を、DB に保存された日本語の固定値
   * （`ANNOUNCEMENT_REASON_OPTIONS` の 5 値）から表示用にローカライズするための辞書。
   * 完全一致のみ置換し、admin 自由入力の reason はそのまま透過する。
   */
  announcementReasonByJa: Record<string, string>
}

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

/**
 * 一般タブ用: `is_admin_origin === false` のみ想定。
 */
export function getGeneralNotificationListSubject(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  const byType = labels.subjectByType[n?.type ?? ""]
  if (byType) {
    return byType
  }
  return labels.defaultSubject
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
export function getAdminOpsListSubject(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n, labels)
  }
  if (n?.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    const t = sanitizeAdminNotificationDisplayText(n.title)
    if (t) {
      return truncateSubject(t, 120)
    }
    return labels.adminHeadlineAnnouncementFallback
  }
  const fromTitle = sanitizeAdminNotificationDisplayText(n.title)
  if (fromTitle) {
    return truncateSubject(fromTitle, 100)
  }
  const byType = labels.subjectByType[n?.type ?? ""]
  if (byType) {
    return truncateSubject(byType, 100)
  }
  return labels.adminHeadlineDefault
}

/**
 * DB に保存された JA の reason を、辞書に該当があればローカライズした文字列に置換する。
 * - 完全一致のみ置換（admin 自由入力など想定外の値は透過 → JA のまま）
 * - 既存ユーザー（ja ロケール）でも同一マッピングを通すが、ja 辞書側は同じ文字列を
 *   返すよう構成しているため挙動完全互換
 */
function localizeAnnouncementReason(
  reason: string,
  labels: NotificationDisplayLabels,
): string {
  const mapped = labels.announcementReasonByJa[reason]
  return mapped && mapped.length > 0 ? mapped : reason
}

function adminOpsCategoryBracketLabel(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  const r = sanitizeAdminNotificationDisplayText(n.reason)
  if (r) {
    if (/^transaction_id:/i.test(r)) {
      return labels.adminCategoryTransactionChat
    }
    return localizeAnnouncementReason(r, labels)
  }
  if (n.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    return labels.adminCategoryAnnouncement
  }
  const adminBracket = labels.adminCategoryBracketByType[n.type ?? ""]
  if (adminBracket) {
    return adminBracket
  }
  return labels.subjectByType[n.type ?? ""] ?? labels.adminCategoryDefault
}

/** 運営通知の件名行（DB の title を優先、なければ種別に応じた既定文言）。 */
function getAdminOpsHeadlineSubject(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n, labels)
  }
  if (n?.type === NOTIFICATION_TYPE_ANNOUNCEMENT) {
    return sanitizeAdminNotificationDisplayText(n.title) || labels.adminHeadlineAnnouncementFallback
  }
  const fromTitle = sanitizeAdminNotificationDisplayText(n.title)
  if (fromTitle) {
    return fromTitle
  }
  return labels.subjectByType[n.type ?? ""] ?? labels.adminHeadlineDefault
}

/**
 * 運営タブ・アコーディオン見出し用タイトル（2行）。
 * 1行目: 【カテゴリ（理由）】、2行目: 件名。
 */
export function getAdminOpsAccordionTitle(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  if (!n?.is_admin_origin) {
    return getGeneralNotificationListSubject(n, labels)
  }
  const category = adminOpsCategoryBracketLabel(n, labels)
  const headline = getAdminOpsHeadlineSubject(n, labels)
  if (category.trim() === headline.trim()) {
    return `【${labels.adminBracketPrefix}】\n${headline}`
  }
  return `【${category}】\n${headline}`
}

/**
 * 運営タブ・アコーディオン展開部の本文（`content` のみ）。
 */
export function getAdminOpsAccordionContent(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string {
  if (!n?.is_admin_origin) {
    const c = sanitizeAdminNotificationDisplayText(n?.content)
    return c.length > 0 ? c : labels.emptyContent
  }
  const c = stripLeadingDuplicateAdminPreamble(
    sanitizeAdminNotificationDisplayText(n?.content),
    n.title,
    n.reason,
  )
  return c.length > 0 ? c : labels.emptyContent
}

/**
 * 運営タブ: 理由（`reason` が null/空なら表示しない）。
 *
 * `labels` を渡せば「運営からのお知らせ」の reason が固定 5 値のいずれかであった場合、
 * 表示用にローカライズした文字列を返す（既存呼び出し互換のため省略時は素の reason）。
 */
export function getAdminOpsListReason(
  n: NotificationRow,
  labels?: NotificationDisplayLabels,
): string | null {
  if (!n?.is_admin_origin) {
    return null
  }
  const r = n?.reason?.trim() ?? ""
  if (!r) {
    return null
  }
  if (!labels) {
    return r
  }
  if (/^transaction_id:/i.test(r)) {
    return r
  }
  return localizeAnnouncementReason(r, labels)
}

/**
 * 一般タブ用「詳細」ラベル（運営タブでは使わない想定）。
 */
export function getNotificationBodySectionLabel(
  n: NotificationRow,
  labels: NotificationDisplayLabels,
): string | null {
  if (n?.is_admin_origin) {
    return null
  }
  return labels.bodySectionLabel
}
