import type { Metadata } from "next"
import UpdatePasswordPage from "@/auth/update-password/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.updatePassword.title"),
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <UpdatePasswordPage />
}
