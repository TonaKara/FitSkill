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
export const LAYOUT_TITLE_DEFAULT =
  "GritVib | 挑戦するすべての人に、「好き」を価値にする選択肢を。"

export const LAYOUT_DESCRIPTION =
  "GritVib（グリット・ヴィブ）は、誰でも自分のスキルを売るためのストアを無料で簡単に作れるサービスです。特別な資格がなくても、あなたの日々の積み重ねや「好き」の経験が誰かの価値になります。SNSから手軽に始めて、あなたの「好き」をもっと大切にする副業に。"

/** トップページ（https://gritvib.com/）専用の検索・OG テキスト（画像内テキストではない） */
export const HOME_TITLE_ABSOLUTE =
  "GritVib | 挑戦するすべての人に、「好き」を価値にする選択肢を。"

export const HOME_DESCRIPTION =
  "GritVib（グリット・ヴィブ）は、誰でも自分のスキルを売るためのストアを無料で簡単に作れるサービスです。特別な資格がなくても、あなたの日々の積み重ねや「好き」の経験が誰かの価値になります。SNSから手軽に始めて、あなたの「好き」をもっと大切にする副業に。"

/** 検索向けキーワード（日本語版・ブランド → サービス → 利用シーン → ジャンル） */
export const SITE_KEYWORDS = [
  "GritVib",
  "グリットヴィブ",
  "グリット・ヴィブ",
  "gritvib.com",
  "個人ストア",
  "スキルシェア",
  "スキルマーケット",
  "スキル",
  "趣味",
  "副業",
  "経歴不問",
  "オンライン相談",
  "オンラインレッスン",
  "デジタルコンテンツ",
  "コーチング",
  "勉強",
  "料理",
  "ゲーム",
  "フィットネス",
] as const

/** 英語版キーワード（検索意図を補強する世界共通語彙） */
export const SITE_KEYWORDS_EN = [
  "GritVib",
  "gritvib.com",
  "personal store",
  "skill sharing",
  "skill marketplace",
  "skills",
  "hobbies",
  "side hustle",
  "online consultation",
  "online lessons",
  "digital content",
  "coaching",
  "study",
  "cooking",
  "gaming",
  "fitness",
] as const

/**
 * 検索 / ヘッダーで利用するキーワード集合を locale 別に返す。
 * ブランド名 + 主要語彙のみ。トップページの description が言語ごとに切り替わるため、
 * keywords も合わせて切り替える方が SEO 上一貫性がある。
 */
export function getLocalizedSiteKeywords(locale: "ja" | "en"): readonly string[] {
  return locale === "en" ? SITE_KEYWORDS_EN : SITE_KEYWORDS
}
