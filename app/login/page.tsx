import type { Metadata } from "next"
import { Suspense } from "react"
import LoginPage from "@/login/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.login.title"),
    description: lookupMessage(dict, "metadata.login.description"),
    alternates: { canonical: "/login" },
    robots: { index: false, follow: true },
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
