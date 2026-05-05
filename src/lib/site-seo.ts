/** サイト全体の SEO 定数（metadataBase 解決・各ページ metadata の共有用） */

/** 正規 URL・OG の共通起点（必ず HTTPS） */
export const SITE_URL = "https://gritvib.com" as const

/**
 * metadataBase・OG 等の絶対 URL 解決用。
 * - 本番: Vercel で `NEXT_PUBLIC_SITE_URL=https://gritvib.com` を推奨
 * - プレビュー: `VERCEL_URL` を自動利用（デプロイごとのホストで favicon / apple-touch が正しく解決される）
 */
export function getSiteUrl(): string {
  const trim = (u: string) => u.replace(/\/$/, "")
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (fromEnv) {
    return trim(fromEnv)
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return trim(`https://${vercel}`)
  }
  return SITE_URL
}

/** ルートレイアウトのデフォルト（子ページが title を上書きしない場合） */
export const LAYOUT_TITLE_DEFAULT = "GritVib | フィットネススキルマーケットプレイス"

export const LAYOUT_DESCRIPTION =
  "フィットネスに特化したスキル売買のマーケットプレイス。パーソナルトレーニングやオンラインレッスンなどの指導スキルを出品・購入でき、相談から始められる安心の取引で運動をもっと身近に。"

/** トップページ専用（検索スニペット向け・他ページより訴求を強く） */
export const HOME_TITLE_ABSOLUTE =
  "GritVib | フィットネススキルマーケットプレイス — パーソナル・オンラインレッスンを安心取引"

export const HOME_DESCRIPTION =
  "パーソナルトレーニングやオンラインレッスンなど、フィットネス指導スキルを出品・購入できるGritVib（グリットヴィブ）。相談から始められる透明な取引で、理想のトレーニングが見つかります。"

export const SITE_KEYWORDS = [
  "GritVib",
  "グリットヴィブ",
  "フィットネス",
  "パーソナルトレーニング",
  "スキルマーケット",
  "オンラインレッスン",
  "トレーニング指導",
  "スポーツ",
  "健康",
  "gritvib.com",
] as const
