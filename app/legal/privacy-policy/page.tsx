import type { Metadata } from "next"
import PrivacyPolicyPage from "@/legal/privacy-policy/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.privacy.title"),
    description: lookupMessage(dict, "metadata.privacy.description"),
    alternates: { canonical: "/legal/privacy-policy" },
    openGraph: { url: "/legal/privacy-policy" },
  }
}

export default function Page() {
  return <PrivacyPolicyPage />
}
