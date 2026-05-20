import type { Metadata } from "next"
import MaintenancePage from "@/maintenance/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.maintenance.title"),
    description: lookupMessage(dict, "metadata.maintenance.description"),
    alternates: { canonical: "/maintenance" },
    openGraph: { url: "/maintenance" },
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <MaintenancePage />
}
