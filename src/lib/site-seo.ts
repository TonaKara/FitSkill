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

/** ルートレイアウトのデフォルト（子ページが title を上書きしない場合）— トップ以外の既定 */
export const LAYOUT_TITLE_DEFAULT = "GritVib | 経歴不問のフィットネススキルシェア"

export const LAYOUT_DESCRIPTION =
  "経歴や肩書にとらわれず、フィットネスの知識や指導スキルをシェア・取引できるマーケットプレイス。パーソナルトレーニングやオンラインレッスンなど、相談から始められる透明な取引で運動をもっと身近に。"

/** トップページ（https://gritvib.com/）専用の検索・OG テキスト */
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
