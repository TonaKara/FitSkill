/**
 * 運営レビュー（newvibes_admin_reviews）入力値の検証ユーティリティ。
 *
 * - クライアント (フォーム) と サーバー (Route Handler) で **同一の閾値** を使うため、
 *   両方からこのモジュールを参照する。
 * - 文字数制限は DB 側の CHECK 制約と一致させる:
 *     title   1〜100
 *     summary 1〜200
 *     body    1〜10,000
 */

export const ADMIN_REVIEW_LIMITS = {
  TITLE_MAX: 100,
  SUMMARY_MAX: 200,
  BODY_MAX: 10_000,
} as const

export type AdminReviewInputErrorKey =
  | "titleRequired"
  | "titleTooLong"
  | "summaryRequired"
  | "summaryTooLong"
  | "bodyRequired"
  | "bodyTooLong"
  | "iconInvalid"

export type AdminReviewDraft = {
  title: string
  summary: string
  body: string
  iconPath?: string | null
  iconUrl?: string | null
  status?: "draft" | "published"
}

export type AdminReviewSanitized = {
  title: string
  summary: string
  body: string
  iconPath: string | null
  iconUrl: string | null
  status: "draft" | "published"
}

/**
 * 入力 draft を検証して、サーバー保存用の正規化済み値に変換する。
 * - エラーキーは UI 側で i18n に解決させる。
 * - 改行は `\r\n` → `\n` に正規化し、前後空白は除去（本文中は保持）。
 */
export function validateAdminReviewDraft(
  draft: AdminReviewDraft,
):
  | { ok: true; value: AdminReviewSanitized }
  | { ok: false; errors: AdminReviewInputErrorKey[] } {
  const errors: AdminReviewInputErrorKey[] = []

  const title = (draft.title ?? "").trim()
  if (title.length === 0) {
    errors.push("titleRequired")
  } else if (title.length > ADMIN_REVIEW_LIMITS.TITLE_MAX) {
    errors.push("titleTooLong")
  }

  const summary = (draft.summary ?? "").trim()
  if (summary.length === 0) {
    errors.push("summaryRequired")
  } else if (summary.length > ADMIN_REVIEW_LIMITS.SUMMARY_MAX) {
    errors.push("summaryTooLong")
  }

  const body = normalizeNewlines((draft.body ?? "").trim())
  if (body.length === 0) {
    errors.push("bodyRequired")
  } else if (body.length > ADMIN_REVIEW_LIMITS.BODY_MAX) {
    errors.push("bodyTooLong")
  }

  const iconPath = sanitizeOptionalString(draft.iconPath, 500)
  const iconUrl = sanitizeOptionalString(draft.iconUrl, 1000)
  if (iconUrl && !/^https?:\/\//.test(iconUrl)) {
    errors.push("iconInvalid")
  }

  const status: "draft" | "published" = draft.status === "draft" ? "draft" : "published"

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    value: { title, summary, body, iconPath, iconUrl, status },
  }
}

function sanitizeOptionalString(input: unknown, max: number): string | null {
  if (typeof input !== "string") {
    return null
  }
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return null
  }
  return trimmed.slice(0, max)
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n?/g, "\n")
}

export const ADMIN_REVIEW_ICONS_BUCKET = "newvibes-admin-review-icons"
