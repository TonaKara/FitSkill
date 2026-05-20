import type { Metadata } from "next"
import HomePage from "@/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { getSiteUrl, HOME_DESCRIPTION, HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

const siteBase = getSiteUrl().replace(/\/$/, "")

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "metadata.homeTitle") || HOME_TITLE_ABSOLUTE
  const description = lookupMessage(dict, "metadata.homeDescription") || HOME_DESCRIPTION
  /** トップ専用 OG 画像（クローラ向けに絶対 URL。`npm run generate:brand-assets` で `public/og-home.png`） */
  const homeOgImage = {
    url: `${siteBase}/og-home.png`,
    width: 1200,
    height: 630,
    alt: title,
  } as const
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      url: `${siteBase}/`,
      title,
      description,
      images: [homeOgImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [homeOgImage.url],
    },
  }
}

export default function Page() {
  return <HomePage />
}
