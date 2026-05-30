import type { Metadata } from "next"
import { Suspense } from "react"

import FromHereSignInPage from "@/fromhere/signin/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.auth.signinTitle")
  const description = lookupMessage(dict, "fromhere.auth.signinSubtitle")
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/signin" },
    robots: { index: false, follow: true },
    openGraph: { url: "/fromhere/signin", title, description },
  }
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FromHereSignInPage />
    </Suspense>
  )
}
