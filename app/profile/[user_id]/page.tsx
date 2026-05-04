import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import ProfilePage from "@/profile/[user_id]/page"
import { LAYOUT_DESCRIPTION } from "@/lib/site-seo"

type ProfilePageProps = {
  params: Promise<{ user_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function truncateDescription(raw: string | null | undefined, max = 160): string {
  if (raw == null || raw.trim().length === 0) {
    return ""
  }
  const t = raw.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user_id: string }>
}): Promise<Metadata> {
  const { user_id } = await params
  const canonicalPath = `/profile/${user_id}`
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return {
      title: "プロフィール",
      description: LAYOUT_DESCRIPTION,
      alternates: { canonical: canonicalPath },
      robots: { index: false, follow: true },
    }
  }
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data } = await supabase
    .from("profiles")
    .select("display_name, bio")
    .eq("id", user_id)
    .maybeSingle()

  const displayName =
    typeof data?.display_name === "string" && data.display_name.trim().length > 0
      ? data.display_name.trim()
      : "トレーナー"
  const bioTrunc = truncateDescription(typeof data?.bio === "string" ? data.bio : null)
  const description =
    bioTrunc.length > 0
      ? bioTrunc
      : `${displayName}さんの公開プロフィール。GritVibでフィットネス指導スキルを掲載しています。`

  const ogTitle = `${displayName}のプロフィール`

  return {
    title: ogTitle,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: ogTitle,
      description,
      url: canonicalPath,
      type: "website",
      locale: "ja_JP",
      siteName: "GritVib",
    },
    twitter: {
      card: "summary",
      title: ogTitle,
      description,
    },
  }
}

export default async function Page({ params, searchParams }: ProfilePageProps) {
  await params
  await searchParams
  return <ProfilePage />
}
