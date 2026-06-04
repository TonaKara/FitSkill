import type { Metadata } from "next"
import LegalContactPage from "@/legal/contact/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.legalContact.title"),
    description: lookupMessage(dict, "metadata.legalContact.description"),
    alternates: { canonical: "/legal/contact" },
    openGraph: { url: "/legal/contact" },
  }
}

export default function Page() {
  return <LegalContactPage />
}
