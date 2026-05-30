import type { Metadata } from "next"

import { FromHerePage } from "@/fromhere/FromHerePage"
import { fetchFromHereHomeData } from "@/fromhere/_data"
import { fetchLatestPublishedAdminReviews } from "@/fromhere/_admin-reviews-data"
import { detectIsFromHereAdmin } from "@/lib/fromhere-admin-check"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/** ホームの動的データに依存するため、毎リクエストでフレッシュに取得する */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.metaTitle")
  const description = lookupMessage(dict, "fromhere.metaDescription")
  // og:image / og:image:alt / twitter:image は `app/fromhere/opengraph-image.tsx` の
  // ファイル規約により Next.js が自動で <head> に挿入する。ここでは明示しない。
  return {
    title,
    description,
    alternates: { canonical: "/fromhere" },
    openGraph: {
      url: "/fromhere",
      title,
      description,
      siteName: "FromHere",
      type: "website",
      locale: locale === "ja" ? "ja_JP" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function Page() {
  /**
   * 運営レビュー（最新 15 件）と管理者判定は別クエリで取得して並列ロード。
   * `fetchFromHereHomeData` 側に組み込まないのは、レビュー機能を後付けで足したため
   * Home 型の責務を肥大化させたくないという設計判断。
   */
  const [data, reviews, isAdmin] = await Promise.all([
    fetchFromHereHomeData(),
    fetchLatestPublishedAdminReviews(),
    detectIsFromHereAdmin(),
  ])
  return <FromHerePage initialData={data} initialReviews={reviews} isAdmin={isAdmin} />
}
