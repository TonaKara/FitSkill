import type { Metadata } from "next"
import SpecifiedCommercialTransactionsPage from "@/legal/specified-commercial-transactions/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.specifiedCommercialTransactions.title"),
    description: lookupMessage(dict, "metadata.specifiedCommercialTransactions.description"),
    alternates: { canonical: "/legal/specified-commercial-transactions" },
    openGraph: { url: "/legal/specified-commercial-transactions" },
  }
}

export default function Page() {
  return <SpecifiedCommercialTransactionsPage />
}
