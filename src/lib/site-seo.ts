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

function readTrustedPublicSiteOrigin(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!fromEnv) {
    return null
  }
  const normalized = normalizeSiteOrigin(fromEnv)
  const hostname = new URL(normalized).hostname.toLowerCase()
  if (hostname !== CANONICAL_HOSTNAME) {
    return null
  }
  return normalized
}

/** 本番の正規オリジン（`NEXT_PUBLIC_SITE_URL` が gritvib.com 系のときのみ採用） */
export function getProductionCanonicalOrigin(): string {
  return readTrustedPublicSiteOrigin() ?? SITE_URL
}

/** canonical / metadataBase 用の正規オリジン（Vercel プレビュー URL は使わない） */
export function getCanonicalSiteUrl(): string {
  return getProductionCanonicalOrigin()
}

/** sitemap / robots 用のベース URL（常に独自ドメイン） */
export function getSitemapBaseUrl(): string {
  return SITE_URL.replace(/\/$/, "")
}

/** sitemap エントリ用の絶対 URL（例: `/about` → `https://gritvib.com/about`） */
export function buildSitemapEntryUrl(pathname: string): string {
  const base = getSitemapBaseUrl()
  const normalized = pathname.trim()
  if (!normalized || normalized === "/") {
    return `${base}/`
  }
  const path = normalized.startsWith("/") ? normalized : `/${normalized}`
  return `${base}${path}`
}

/** www → apex リダイレクト先ホスト名 */
export function getCanonicalHostname(): string {
  return new URL(getCanonicalSiteUrl()).hostname.toLowerCase()
}

/** 正規ドメイン上の canonical 絶対 URL（例: `/about` → `https://gritvib.com/about`） */
export function buildCanonicalUrl(pathname: string): string {
  const base = getCanonicalSiteUrl().replace(/\/$/, "")
  const normalized = pathname.trim()
  if (!normalized || normalized === "/") {
    return `${base}/`
  }
  const path = normalized.startsWith("/") ? normalized : `/${normalized}`
  return `${base}${path}`
}

/**
 * metadataBase・OG・sitemap 等の絶対 URL 解決用。
 * 検索向けの正規ホストは常に {@link getCanonicalSiteUrl}（既定 `https://gritvib.com`）。
 */
export function getSiteUrl(): string {
  return getCanonicalSiteUrl()
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
