import type { Metadata } from "next"

import { PeriodPageClient } from "@/fromhere/_period/PeriodPageClient"
import {
  fetchTodayAllProducts,
  fetchUpvotedProductIdsForViewer,
  HOME_RANKING_THRESHOLD,
} from "@/fromhere/_data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/** 動的データのため毎リクエスト取得 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.section.todayHeading")
  const description = lookupMessage(dict, "fromhere.section.todayPageHint")
  return {
    title: `${title} | FromHere`,
    description,
    alternates: { canonical: "/fromhere/today" },
  }
}

export default async function Page() {
  const [{ products, totalCount }, upvotedIds] = await Promise.all([
    fetchTodayAllProducts(),
    fetchUpvotedProductIdsForViewer(),
  ])
  return (
    <PeriodPageClient
      period="today"
      products={products}
      totalCount={totalCount}
      rankingThreshold={HOME_RANKING_THRESHOLD.today}
      initialUpvotedProductIds={upvotedIds}
    />
  )
}
