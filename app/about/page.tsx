import type { Metadata } from "next"
import AboutPage from "@/about/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.about.title"),
    description: lookupMessage(dict, "metadata.about.description"),
    alternates: { canonical: "/about" },
    openGraph: { url: "/about" },
  }
}

export default function Page() {
  return <AboutPage />
}
