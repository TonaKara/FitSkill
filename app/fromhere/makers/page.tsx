import type { Metadata } from "next"

import { MakersPageClient } from "@/fromhere/makers/MakersPageClient"
import { fetchFromHereMakers } from "@/fromhere/_makers-data"
import { readMakersQuery } from "@/fromhere/_makers-config"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/** 動的データ（メーカー集計）に依存するため、毎リクエストで取得する */
export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.makers.metaTitle")
  const description = lookupMessage(dict, "fromhere.makers.metaDescription")
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/makers" },
    openGraph: {
      url: "/fromhere/makers",
      title,
      description,
    },
  }
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const { sort, page } = readMakersQuery(params)
  const data = await fetchFromHereMakers({ sort, page })
  return <MakersPageClient data={data} />
}
