import type { Metadata } from "next"

import { PeriodPageClient } from "@/fromhere/_period/PeriodPageClient"
import {
  fetchThisMonthAllProducts,
  fetchUpvotedProductIdsForViewer,
  HOME_RANKING_THRESHOLD,
} from "@/fromhere/_data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.section.thisMonthHeading")
  const description = lookupMessage(dict, "fromhere.section.thisMonthPageHint")
  return {
    title: `${title} | FromHere`,
    description,
    alternates: { canonical: "/fromhere/month" },
  }
}

export default async function Page() {
  const [{ products, totalCount }, upvotedIds] = await Promise.all([
    fetchThisMonthAllProducts(),
    fetchUpvotedProductIdsForViewer(),
  ])
  return (
    <PeriodPageClient
      period="thisMonth"
      products={products}
      totalCount={totalCount}
      rankingThreshold={HOME_RANKING_THRESHOLD.thisMonth}
      initialUpvotedProductIds={upvotedIds}
    />
  )
}
