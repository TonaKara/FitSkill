import type { Metadata } from "next"
import HomePage from "@/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { getSiteUrl, HOME_DESCRIPTION, HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

/**
 * 旧トップ (GritVib スキルマーケットプレイス) の退避先。
 *
 * `/` を新サービス (GritVib 人間チャット) に差し替えたことに伴い、従来 `/` で見えていた
 * `MyStoreHomeClient` をこちらで配信する。中身・SEO 構造は当初の `/` を踏襲し、
 * canonical / openGraph url のみ `/store` に書き換えている。
 */

export const dynamic = "force-dynamic"

const siteBase = getSiteUrl().replace(/\/$/, "")

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "metadata.homeTitle") || HOME_TITLE_ABSOLUTE
  const description = lookupMessage(dict, "metadata.homeDescription") || HOME_DESCRIPTION
  const homeOgImage = {
    url: `${siteBase}/og-home.png`,
    width: 1200,
    height: 630,
    alt: title,
  } as const
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/store" },
    openGraph: {
      url: `${siteBase}/store`,
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
