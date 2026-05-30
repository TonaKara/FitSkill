import type { Metadata } from "next"
import { Suspense } from "react"

import FromHereOnboardingPage from "@/fromhere/onboarding/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.onboarding.title")
  const description = lookupMessage(dict, "fromhere.onboarding.subtitle")
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/onboarding" },
    robots: { index: false, follow: false },
    openGraph: { url: "/fromhere/onboarding", title, description },
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FromHereOnboardingPage />
    </Suspense>
  )
}
