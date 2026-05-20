import type { Metadata } from "next"
import TermsPage from "@/legal/terms/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.terms.title"),
    description: lookupMessage(dict, "metadata.terms.description"),
    alternates: { canonical: "/legal/terms" },
    openGraph: { url: "/legal/terms" },
  }
}

export default function Page() {
  return <TermsPage />
}
