import type { Metadata } from "next"
import ProfileSetupBasicPage from "@/profile-setup/basic/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "profileBasicInfo.title"),
    description: lookupMessage(dict, "profileBasicInfo.subtitle"),
    alternates: { canonical: "/profile-setup/basic" },
    openGraph: { url: "/profile-setup/basic" },
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <ProfileSetupBasicPage />
}
