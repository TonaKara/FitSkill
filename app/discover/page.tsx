import type { Metadata } from "next"
import DiscoverSkillsClient from "@/discover/DiscoverSkillsClient"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.discover.title"),
    description: lookupMessage(dict, "metadata.discover.description"),
    alternates: { canonical: "/discover" },
    robots: { index: true, follow: true },
  }
}

export default function DiscoverPage() {
  return <DiscoverSkillsClient />
}
