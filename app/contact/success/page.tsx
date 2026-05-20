import type { Metadata } from "next"
import ContactSuccessPage from "@/contact/success/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.contact.successTitle"),
    description: lookupMessage(dict, "metadata.contact.successDescription"),
    alternates: { canonical: "/contact/success" },
    openGraph: { url: "/contact/success" },
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <ContactSuccessPage />
}
