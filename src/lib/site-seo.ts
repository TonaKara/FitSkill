/** サイト全体の SEO 定数（metadataBase 解決・各ページ metadata の共有用） */

/** 正規 URL・OG の共通起点（必ず HTTPS・www なし） */
export const SITE_URL = "https://gritvib.com" as const

const CANONICAL_HOSTNAME = new URL(SITE_URL).hostname.toLowerCase()

function parsePublicOrigin(raw: string): URL {
  return new URL(raw.includes("://") ? raw : `https://${raw}`)
}

/** gritvib.com 系のホストは apex + HTTPS に揃える（canonical / metadataBase 用） */
export function normalizeSiteOrigin(raw: string): string {
  const url = parsePublicOrigin(raw.trim())
  const hostname = url.hostname.toLowerCase()
  if (hostname === CANONICAL_HOSTNAME || hostname === `www.${CANONICAL_HOSTNAME}`) {
    url.hostname = CANONICAL_HOSTNAME
    url.protocol = "https:"
    url.port = ""
  }
  url.pathname = ""
  url.search = ""
  url.hash = ""
  return url.origin.replace(/\/$/, "")
}

/** 本番の正規オリジン（環境変数が www でも apex に正規化） */
export function getProductionCanonicalOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) {
    return normalizeSiteOrigin(fromEnv)
  }
  return SITE_URL
}

/** www → apex リダイレクト先ホスト名 */
export function getCanonicalHostname(): string {
  return new URL(getProductionCanonicalOrigin()).hostname.toLowerCase()
}

/**
 * metadataBase・OG 等の絶対 URL 解決用。
 * - 本番: `NEXT_PUBLIC_SITE_URL=https://gritvib.com`（www なし）を推奨
 * - プレビュー: `VERCEL_URL` を自動利用（デプロイごとのホストで favicon / apple-touch が正しく解決される）
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) {
    return normalizeSiteOrigin(fromEnv)
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return `https://${vercel}`.replace(/\/$/, "")
  }
  return SITE_URL
}

/**
 * リダイレクト・メール内リンク・Stripe return URL 用の公開オリジン。
 * `NEXT_PUBLIC_APP_URL` を最優先し、未設定時は本番・プレビューは {@link getSiteUrl}、開発のみ localhost。
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) {
    return normalizeSiteOrigin(explicit)
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000"
  }
  return getSiteUrl()
}

/** ルートレイアウトのデフォルト（子ページが title を上書きしない場合）— トップ以外の既定 */
export const LAYOUT_TITLE_DEFAULT = "GritVib | 経歴不問のフィットネススキルシェア"

export const LAYOUT_DESCRIPTION =
  "経歴や肩書にとらわれず、フィットネスの知識や指導スキルをシェア・取引できるマーケットプレイス。パーソナルトレーニングやオンラインレッスンなど、相談から始められる透明な取引で運動をもっと身近に。"

/** トップページ（https://gritvib.com/）専用の検索・OG テキスト（画像内テキストではない） */
export const HOME_TITLE_ABSOLUTE = "GritVib | フィットネススキルのマーケットプレイス"

export const HOME_DESCRIPTION =
  "プロのトレーナーから初心者まで、誰でもフィットネススキルを教えたり学んだりできるマーケットプレイス。"

export const SITE_KEYWORDS = [
  "GritVib",
  "グリットヴィブ",
  "フィットネス",
  "パーソナルトレーニング",
  "スキルシェア",
  "スキルマーケット",
  "経歴不問",
  "オンラインレッスン",
  "トレーニング指導",
  "スポーツ",
  "健康",
  "gritvib.com",
] as const
