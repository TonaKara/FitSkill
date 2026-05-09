import type { Metadata } from "next"
import HomePage from "@/page"
import { HOME_DESCRIPTION, HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

export const dynamic = "force-dynamic"

/** トップ専用 OG 画像（赤角丸タイル＋白マークのブランドロゴ。`npm run generate:brand-assets`） */
const HOME_OG_IMAGE = {
  url: "/og-home.png",
  width: 1200,
  height: 630,
  alt: HOME_TITLE_ABSOLUTE,
} as const

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE_ABSOLUTE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
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
