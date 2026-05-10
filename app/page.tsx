import type { Metadata } from "next"
import HomePage from "@/page"
import { getSiteUrl, HOME_DESCRIPTION, HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

const siteBase = getSiteUrl().replace(/\/$/, "")

/** トップ専用 OG 画像（クローラ向けに絶対 URL。`npm run generate:brand-assets` で `public/og-home.png`） */
const HOME_OG_IMAGE = {
  url: `${siteBase}/og-home.png`,
  width: 1200,
  height: 630,
  alt: HOME_TITLE_ABSOLUTE,
} as const

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE_ABSOLUTE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: `${siteBase}/`,
    title: HOME_TITLE_ABSOLUTE,
    description: HOME_DESCRIPTION,
    images: [HOME_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE_ABSOLUTE,
    description: HOME_DESCRIPTION,
    images: [HOME_OG_IMAGE.url],
  },
}

export default function Page() {
  return <HomePage />
}
