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

/** ルートレイアウトのデフォルト（子ページが title を上書きしない場合） */
export const LAYOUT_TITLE_DEFAULT = "人として、生きるということ。| GritVib"

export const LAYOUT_DESCRIPTION =
  "ChatGPTの代わりに、人間がチャットの相手になります。完璧ではありません。人間だからです。"

/** 現行トップ (`/`) — 人間チャットサービスの検索・OG テキスト */
export const GRITVIB_LANDING_TITLE_ABSOLUTE = "人として、生きるということ。| GritVib"

export const GRITVIB_LANDING_DESCRIPTION =
  "ChatGPTの代わりに、人間がチャットの相手になります。完璧ではありません。人間だからです。"

/**
 * トップ (`/`) の OGP 用静止画。
 *
 * - 保存場所: `public/og-gritvib-landing.png`（リポジトリ直下の public フォルダ）
 * - 実ファイル: 1024 × 537 px（`public/og-gritvib-landing.png`）
 * - 形式: PNG
 */
export const GRITVIB_LANDING_OG_IMAGE_PATH = "/og-gritvib-landing.png"

export const GRITVIB_LANDING_OG_IMAGE_SIZE = { width: 1024, height: 537 } as const

/**
 * 旧スキルマーケット (`/store`) 向けの検索・OG テキスト。
 * `metadata.homeTitle` / `metadata.homeDescription`（i18n）と揃える。
 */
export const STORE_HOME_TITLE_ABSOLUTE =
  "GritVib | 挑戦するすべての人に、「好き」を価値にする選択肢を。"

export const STORE_HOME_DESCRIPTION =
  "GritVib（グリット・ヴィブ）は、誰でも自分のスキルを売るためのストアを無料で簡単に作れるサービスです。特別な資格がなくても、あなたの日々の積み重ねや「好き」の経験が誰かの価値になります。SNSから手軽に始めて、あなたの「好き」をもっと大切にする副業に。"

/** @deprecated {@link STORE_HOME_TITLE_ABSOLUTE} を使用 */
export const HOME_TITLE_ABSOLUTE = STORE_HOME_TITLE_ABSOLUTE

/** @deprecated {@link STORE_HOME_DESCRIPTION} を使用 */
export const HOME_DESCRIPTION = STORE_HOME_DESCRIPTION

/** 検索向けキーワード（日本語・現行 GritVib 人間チャット） */
export const SITE_KEYWORDS = [
  "GritVib",
  "グリットヴィブ",
  "グリット・ヴィブ",
  "gritvib.com",
  "人間チャット",
  "チャット",
  "サブスクリプション",
  "月額3000円",
  "対話",
  "人と話す",
  "AIではない",
  "通知なし",
] as const

/** 英語版キーワード */
export const SITE_KEYWORDS_EN = [
  "GritVib",
  "gritvib.com",
  "human chat",
  "subscription chat",
  "conversation",
  "not AI",
  "slow reply",
  "text chat",
] as const

/**
 * 検索 / ヘッダーで利用するキーワード集合を locale 別に返す。
 * ブランド名 + 主要語彙のみ。トップページの description が言語ごとに切り替わるため、
 * keywords も合わせて切り替える方が SEO 上一貫性がある。
 */
export function getLocalizedSiteKeywords(locale: "ja" | "en"): readonly string[] {
  return locale === "en" ? SITE_KEYWORDS_EN : SITE_KEYWORDS
}
