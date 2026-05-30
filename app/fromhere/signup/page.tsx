import type { Metadata } from "next"
import { Suspense } from "react"

import FromHereSignUpPage from "@/fromhere/signup/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.auth.signupTitle")
  const description = lookupMessage(dict, "fromhere.auth.signupSubtitle")
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/signup" },
    robots: { index: false, follow: true },
    openGraph: { url: "/fromhere/signup", title, description },
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FromHereSignUpPage />
    </Suspense>
  )
}
