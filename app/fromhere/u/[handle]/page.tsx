import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { MakerProfilePageClient } from "@/fromhere/u/[handle]/MakerProfilePageClient"
import { fetchMakerProfile, normalizeHandleParam } from "@/fromhere/_maker-data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale, localeToOgLocale } from "@/lib/i18n/server-detect"

/** 動的データに依存するため、毎リクエストで取得する */
export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ handle: string }>
}

/** 本体ストア（/store/[user_id]）の OGP と同じ規約で description を短縮する */
function truncateDescription(raw: string | null | undefined, max = 160): string {
  if (raw == null || raw.trim().length === 0) {
    return ""
  }
  const t = raw.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle: rawHandle } = await params
  const handle = normalizeHandleParam(decodeURIComponent(rawHandle))
  if (!handle) {
    return { title: "FromHere" }
  }
  const data = await fetchMakerProfile(handle)
  if (!data) {
    return { title: "FromHere" }
  }
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const titleTemplate = lookupMessage(dict, "fromhere.profile.metaTitle")
  const descriptionTemplate = lookupMessage(dict, "fromhere.profile.metaDescription")
  const canonical = `/fromhere/u/${data.handle}`

  /**
   * 本体ストア共有時と同じカード表示にするため、SNS 共有用のタイトルは displayName だけにする。
   * ブラウザの <title> タブ表示はハンドル併記の方が情報量が多いので、HTML title は従来どおり残す。
   * OGP/Twitter のみ displayName 単体に揃える（本体 `/store/[user_id]` 実装と同じ方針）。
   */
  const htmlTitle = titleTemplate
    .replace("{name}", data.displayName)
    .replace("{handle}", data.handle)
  const socialTitle = data.displayName || data.handle
  const fallbackDescription = descriptionTemplate.replace("{name}", data.displayName || data.handle)
  const bioTrunc = truncateDescription(data.bio)
  const description = bioTrunc.length > 0 ? bioTrunc : fallbackDescription
  const avatarImage =
    typeof data.avatarUrl === "string" && data.avatarUrl.trim().length > 0
      ? data.avatarUrl.trim()
      : null

  return {
    title: htmlTitle,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title: socialTitle,
      description,
      type: "profile",
      locale: localeToOgLocale(locale),
      siteName: "FromHere",
      images: avatarImage ? [{ url: avatarImage }] : undefined,
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
      images: avatarImage ? [avatarImage] : undefined,
    },
  }
}

export default async function Page({ params }: PageProps) {
  const { handle: rawHandle } = await params
  const handle = normalizeHandleParam(decodeURIComponent(rawHandle))
  if (!handle) {
    notFound()
  }
  const data = await fetchMakerProfile(handle)
  if (!data) {
    notFound()
  }
  return <MakerProfilePageClient data={data} />
}
