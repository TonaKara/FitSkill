/**
 * FromHere プロダクト投稿のバリデーション。
 *
 * 設計の原則:
 * - DB の CHECK 制約や RLS と「同じ」制約を、ここに集中させる。
 * - クライアントとサーバーで同じユーティリティを使い、UX とセキュリティの両方を守る。
 * - **クライアントの検証は信頼しない**。最終判定は必ずサーバー側 (`/api/fromhere/products`) と DB で行う。
 */

export const FROMHERE_CATEGORIES = [
  "ai",
  "dev",
  "saas",
  "mobile",
  "web",
  "productivity",
  "design",
  "game",
  "other",
] as const

export type FromHereCategory = (typeof FROMHERE_CATEGORIES)[number]

export const FROMHERE_TITLE_MAX = 30
/**
 * キャッチコピー上限。
 *
 * DB の CHECK 制約は char_length(tagline) BETWEEN 1 AND 200 と緩めだが、
 * アプリ層では UI / UX の観点でより短い 30 文字に制限する。
 * （DB 制約は既存レコード保護のため緩めに保持）
 */
export const FROMHERE_TAGLINE_MAX = 30
/**
 * 詳細説明上限。
 *
 * DB の CHECK 制約は char_length(description) <= 5000 だが、アプリ層では 500 文字に制限する。
 */
export const FROMHERE_DESCRIPTION_MAX = 500
export const FROMHERE_TAG_MAX_COUNT = 5
export const FROMHERE_TAG_MAX_LENGTH = 20
export const FROMHERE_PRODUCT_URL_MAX = 2048

/**
 * 投稿フォームに表示する推奨タグ。
 *
 * - 自由入力タグと並存し、クリックで現在の `tags` に追加する用途。
 * - DB には保存しない（あくまでクライアント UI のヒント）。
 * - 表記揺れを防ぐため正規表現は通さず、ここで表示する文字列をそのまま使う。
 */
export const FROMHERE_SUGGESTED_TAGS = [
  "AI",
  "LLM",
  "SaaS",
  "Mobile",
  "iOS",
  "Android",
  "Web",
  "Productivity",
  "Developer Tools",
  "Open Source",
  "Design",
  "Game",
  "Indie",
  "Free",
  "API",
] as const

export const FROMHERE_APP_ICON_MAX_BYTES = 1 * 1024 * 1024 // 1 MB
export const FROMHERE_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export const FROMHERE_ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const

export type FromHereAllowedImageMime = (typeof FROMHERE_ALLOWED_IMAGE_MIME)[number]

export const FROMHERE_APP_ICONS_BUCKET = "newvibes-app-icons"
export const FROMHERE_SCREENSHOTS_BUCKET = "newvibes-screenshots"

/** タグに許可する文字: 英数字 / 日本語 / スペース / ハイフン / ドット / アンダースコア。`<>"'&` などは弾く */
/**
 * タグに許容する文字集合:
 * - Unicode 文字（日本語含む `\p{L}`）/ 数字（`\p{N}`）
 * - 半角スペース・アンダースコア・ハイフン・ドット
 * - それ以外（記号 `+`、絵文字、`@` 等）は不可
 *
 * クライアント側でリアルタイムに警告表示するため export。
 */
export const FROMHERE_TAG_ALLOWED_REGEX = /^[\p{L}\p{N} _\-.]+$/u
const TAG_ALLOWED_REGEX = FROMHERE_TAG_ALLOWED_REGEX

/**
 * 説明文に HTML タグ風の文字列が含まれているか。
 * - 表示時に React がエスケープするので保存しても害は薄いが、ユーザーが意図せず
 *   タグを書いてしまった場合に「使えない」と伝えるための判定。
 * - 単純な `/<[a-zA-Z!/]/` でタグの開始らしき箇所を検出する。
 */
export const FROMHERE_DESCRIPTION_HTML_REGEX = /<[a-zA-Z!/]/

/** タグ単体が許容文字のみで構成されているか（空文字列は true 扱い: 入力途中で警告を出さないため） */
export function isFromHereTagCharsAllowed(tag: string): boolean {
  if (tag.length === 0) return true
  return FROMHERE_TAG_ALLOWED_REGEX.test(tag)
}

/** 説明文に HTML タグ風の文字列が含まれているか */
export function containsFromHereDescriptionHtml(description: string): boolean {
  return FROMHERE_DESCRIPTION_HTML_REGEX.test(description)
}

/** product_url の安全な URL かを検証 */
export function isSafeProductUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > FROMHERE_PRODUCT_URL_MAX) {
    return false
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return false
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false
    }
    if (!url.hostname || url.hostname.length > 253) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export type FromHereProductInputErrorKey =
  | "title"
  | "tagline"
  | "description"
  | "category"
  | "tags"
  | "tagsCharset"
  | "productUrl"
  | "productUrlScheme"
  | "appIcon"
  | "appIconRequired"
  | "screenshot"
  | "scheduledDate"

/** ----------------------------------------------------------
 *  公開日（日本時間）に関するユーティリティ
 *
 *  仕様:
 *   - 投稿者は「公開日（JST）」を YYYY-MM-DD で 1 つ指定する。
 *   - 最短で「投稿当日の翌日」を選択可能。
 *   - 公開時刻は選択した日の JST 00:00 に固定（= 公開日のホームで横並びに揃う）。
 *   - DB の `posted_at` に「JST 00:00 を UTC ISO に変換した値」を保存する。
 *     ホーム/一覧クエリは `posted_at <= now()` で未来分を弾く。
 * ---------------------------------------------------------- */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 例外的に「公開予定日として選択できない日」(JST, `YYYY-MM-DD`)。
 *
 * 運営側の事情 (メンテナンス、関連告知などの都合) で特定日を一時的に除外したいときに
 * ここへ追記する。HTML の `<input type="date">` は飛び石的な無効化に対応していないため、
 * `parseFromHereScheduledDateToUtcIso` での検証 + クライアント側のエラー表示で対処する。
 *
 * クライアント側で UI メッセージ切替のために参照することもあるので export している。
 */
export const FROMHERE_BLOCKED_SCHEDULED_DATES: readonly string[] = ["2026-05-31"]

/** 指定された `YYYY-MM-DD` (JST) が公開日として禁止されているかを判定する。 */
export function isFromHereBlockedScheduledDate(date: string): boolean {
  return FROMHERE_BLOCKED_SCHEDULED_DATES.includes(date)
}

/** `now` を JST 換算した日付の翌日を `YYYY-MM-DD` (JST) で返す。 */
export function getFromHereJstTomorrowDateString(now: Date = new Date()): string {
  const nowJst = new Date(now.getTime() + JST_OFFSET_MS)
  // UTC 系のメソッドを使って「JST のカレンダー日付」を取り出す
  const y = nowJst.getUTCFullYear()
  const m = nowJst.getUTCMonth()
  const d = nowJst.getUTCDate()
  // 翌日（月末/年末は Date が自動繰り上げ）
  const tomorrow = new Date(Date.UTC(y, m, d + 1))
  const yy = tomorrow.getUTCFullYear()
  const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(tomorrow.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

/**
 * `YYYY-MM-DD` (JST) を「JST 00:00 → UTC ISO 文字列」に変換して返す。
 *
 * - 形式が不正、または `now` から見て JST の翌日より過去なら null を返す。
 * - 文字列比較で「翌日以降」を判定するため、タイムゾーン依存を完全に排除できる。
 */
export function parseFromHereScheduledDateToUtcIso(
  raw: unknown,
  now: Date = new Date(),
): { ok: true; iso: string } | { ok: false } {
  if (typeof raw !== "string") {
    return { ok: false }
  }
  const trimmed = raw.trim()
  // strict な YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { ok: false }
  }
  const [yStr, mStr, dStr] = trimmed.split("-") as [string, string, string]
  const year = Number(yStr)
  const month = Number(mStr)
  const day = Number(dStr)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { ok: false }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { ok: false }
  }
  // 実在する日付か（例: 2026-02-30 を弾く）
  const utcMs = Date.UTC(year, month - 1, day)
  const back = new Date(utcMs)
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return { ok: false }
  }
  // 翌日チェックは「文字列比較」で行う（タイムゾーン非依存）
  const minDate = getFromHereJstTomorrowDateString(now)
  if (trimmed < minDate) {
    return { ok: false }
  }
  // 例外的に選択不可とする日付を弾く（メンテナンス等の運用都合）
  if (isFromHereBlockedScheduledDate(trimmed)) {
    return { ok: false }
  }
  // JST 00:00 を UTC ISO に。`Date.UTC(y, m-1, d) - 9h` が JST 00:00 = UTC の対応時刻。
  const postedAtMs = utcMs - JST_OFFSET_MS
  return { ok: true, iso: new Date(postedAtMs).toISOString() }
}

export type FromHereProductDraft = {
  title: string
  tagline: string
  description: string
  category: string
  tags: string[]
  productUrl: string
  appIconPath: string | null
  screenshotPath: string | null
}

export type FromHereProductSanitized = {
  title: string
  tagline: string
  description: string | null
  category: FromHereCategory
  tags: string[]
  productUrl: string
  appIconPath: string | null
  screenshotPath: string | null
}

export type FromHereProductValidation =
  | { ok: true; value: FromHereProductSanitized }
  | { ok: false; error: FromHereProductInputErrorKey }

/**
 * プロダクト投稿入力の正規化 + 検証。
 *
 * - 文字列は trim、改行を含む description は trim だけして内部のスペースは保持。
 * - 画像 path は本人の uid フォルダ配下を保証するため、`makerUserId/` で始まるかチェック。
 *   （DB 側でも storage policy で `(storage.foldername(name))[1] = auth.uid()` を強制している）
 * - クライアント側で呼ぶ場合は `makerUserId` を省略でき、その場合 path 検証はスキップする。
 * - `requireAppIcon` を true にすると、`appIconPath` が null の場合に
 *   `"appIconRequired"` エラーを返す（新規投稿時の必須化に使用）。
 *   既存プロダクトの編集 API ではアイコン未設定の旧データを許容する必要があるため
 *   デフォルト false にしている。
 */
export function validateFromHereProductDraft(
  draft: FromHereProductDraft,
  options: { makerUserId?: string; requireAppIcon?: boolean } = {},
): FromHereProductValidation {
  const title = draft.title.trim()
  if (title.length < 1 || title.length > FROMHERE_TITLE_MAX) {
    return { ok: false, error: "title" }
  }

  const tagline = draft.tagline.trim()
  if (tagline.length < 1 || tagline.length > FROMHERE_TAGLINE_MAX) {
    return { ok: false, error: "tagline" }
  }

  const description = draft.description.trim()
  if (description.length > FROMHERE_DESCRIPTION_MAX) {
    return { ok: false, error: "description" }
  }
  // HTML タグの混入を弾く（DB はそのまま保存し、表示時に React がエスケープするが、
  // ペーストミスや手書きタグを早期に弾いておくと表示崩れの心配がない）。
  if (/<[a-zA-Z!/]/.test(description)) {
    return { ok: false, error: "description" }
  }

  if (!isFromHereCategory(draft.category)) {
    return { ok: false, error: "category" }
  }

  if (draft.tags.length > FROMHERE_TAG_MAX_COUNT) {
    return { ok: false, error: "tags" }
  }
  const tags: string[] = []
  const seen = new Set<string>()
  for (const raw of draft.tags) {
    const tag = raw.trim()
    if (tag.length === 0) {
      continue
    }
    if (tag.length > FROMHERE_TAG_MAX_LENGTH) {
      return { ok: false, error: "tags" }
    }
    if (!TAG_ALLOWED_REGEX.test(tag)) {
      return { ok: false, error: "tagsCharset" }
    }
    const key = tag.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    tags.push(tag)
  }

  const productUrl = draft.productUrl.trim()
  if (!/^https?:\/\//i.test(productUrl)) {
    return { ok: false, error: "productUrlScheme" }
  }
  if (!isSafeProductUrl(productUrl)) {
    return { ok: false, error: "productUrl" }
  }

  const appIconPath = sanitizeOptionalStoragePath(draft.appIconPath, options.makerUserId)
  if (draft.appIconPath !== null && appIconPath === undefined) {
    return { ok: false, error: "appIcon" }
  }
  if (options.requireAppIcon && (appIconPath === null || appIconPath === undefined)) {
    return { ok: false, error: "appIconRequired" }
  }

  const screenshotPath = sanitizeOptionalStoragePath(draft.screenshotPath, options.makerUserId)
  if (draft.screenshotPath !== null && screenshotPath === undefined) {
    return { ok: false, error: "screenshot" }
  }

  return {
    ok: true,
    value: {
      title,
      tagline,
      description: description.length === 0 ? null : description,
      category: draft.category as FromHereCategory,
      tags,
      productUrl,
      appIconPath: appIconPath ?? null,
      screenshotPath: screenshotPath ?? null,
    },
  }
}

/**
 * Storage パスを検証して返す。
 * - null → null（未設定）
 * - 不正 → undefined（呼び出し側でエラーへ変換）
 * - 正常 → 正規化された path
 */
function sanitizeOptionalStoragePath(
  raw: string | null,
  ownerUserId: string | undefined,
): string | null | undefined {
  if (raw === null) {
    return null
  }
  const value = raw.trim()
  if (value.length === 0) {
    return null
  }
  if (value.length > 500) {
    return undefined
  }
  // 改行 / バックスラッシュ / 制御文字 / 親ディレクトリ参照を弾く
  if (/[\\\r\n\t\0]/.test(value)) {
    return undefined
  }
  if (value.includes("..")) {
    return undefined
  }
  if (value.startsWith("/")) {
    return undefined
  }
  const segments = value.split("/")
  if (segments.length < 2 || segments.some((seg) => seg.length === 0)) {
    return undefined
  }
  if (ownerUserId && segments[0] !== ownerUserId) {
    return undefined
  }
  return value
}

export function isFromHereCategory(value: string): value is FromHereCategory {
  return (FROMHERE_CATEGORIES as readonly string[]).includes(value)
}

export function isAllowedImageMime(value: string): value is FromHereAllowedImageMime {
  return (FROMHERE_ALLOWED_IMAGE_MIME as readonly string[]).includes(value)
}
