import type { Metadata } from "next"
import GuidePage from "@/guide/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.guide.title"),
    description: lookupMessage(dict, "metadata.guide.description"),
    alternates: { canonical: "/guide" },
    openGraph: { url: "/guide" },
  }
}

export default function Page() {
  return <GuidePage />
}
