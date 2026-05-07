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
export const LAYOUT_TITLE_DEFAULT = "GritVib | 経歴不問のフィットネススキルシェア"

export const LAYOUT_DESCRIPTION =
  "経歴や肩書にとらわれず、フィットネスの知識や指導スキルをシェア・取引できるマーケットプレイス。パーソナルトレーニングやオンラインレッスンなど、相談から始められる透明な取引で運動をもっと身近に。"

/** トップページ専用（検索スニペット向け・他ページより訴求を強く） */
export const HOME_TITLE_ABSOLUTE =
  "GritVib | 経歴不問のフィットネススキルシェア — 相談から始める安心取引"

export const HOME_DESCRIPTION =
  "資格や実績の有無に関わらずスキルを出品でき、学びたい人とつながれるGritVib（グリットヴィブ）。パーソナル・オンラインレッスンなどフィットネス指導のスキルシェアを、相談から透明な取引で。"

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
