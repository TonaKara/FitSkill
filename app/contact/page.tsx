import type { Metadata } from "next"
import ContactPage from "@/contact/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.contact.title"),
    description: lookupMessage(dict, "metadata.contact.description"),
    alternates: { canonical: "/contact" },
    openGraph: { url: "/contact" },
  }
}

export default function Page() {
  return <ContactPage />
}
