import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import ProfilePage from "@/profile/[user_id]/page"
import { isUuid, normalizeCustomId } from "@/lib/profile-path"
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

type ResolvedProfile = {
  id: string
  display_name: string | null
  bio: string | null
  custom_id: string | null
  avatar_url: string | null
}

async function resolveProfile(identifierRaw: string): Promise<ResolvedProfile | null> {
  const identifier = identifierRaw.trim()
  if (!identifier) {
    return null
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const key = supabaseServiceKey ?? supabaseAnonKey
  if (!supabaseUrl || !key) {
    return null
  }
  const supabase = createClient(supabaseUrl, key)
  const baseQuery = supabase.from("profiles").select("id, display_name, bio, custom_id, avatar_url")
  const normalizedCustomId = normalizeCustomId(identifier)
  const { data } = await (isUuid(identifier)
    ? baseQuery.eq("id", identifier).maybeSingle()
    : baseQuery.eq("custom_id", normalizedCustomId).maybeSingle())
  if (!data?.id) {
    return null
  }
  return data as ResolvedProfile
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ user_id: string }>
}): Promise<Metadata> {
  const { user_id } = await params
  const identifier = user_id.trim()
  const canonicalPath = `/profile/${identifier}`
  const profile = await resolveProfile(identifier)
  if (!profile) {
    return {
      title: "プロフィール",
      description: LAYOUT_DESCRIPTION,
      alternates: { canonical: canonicalPath },
      robots: { index: false, follow: true },
    }
  }
  const canonicalSegment =
    typeof profile.custom_id === "string" && profile.custom_id.trim().length > 0 ? profile.custom_id.trim() : identifier
  const resolvedCanonicalPath = `/profile/${encodeURIComponent(canonicalSegment)}`

  const displayName =
    typeof profile.display_name === "string" && profile.display_name.trim().length > 0
      ? profile.display_name.trim()
      : "トレーナー"
  const bioTrunc = truncateDescription(typeof profile.bio === "string" ? profile.bio : null)
  const description =
    bioTrunc.length > 0
      ? bioTrunc
      : `${displayName}さんの公開プロフィール。GritVibでフィットネス指導スキルを掲載しています。`

  const title = displayName
  const avatarImage =
    typeof profile.avatar_url === "string" && profile.avatar_url.trim().length > 0 ? profile.avatar_url.trim() : null

  return {
    title,
    description,
    alternates: { canonical: resolvedCanonicalPath },
    openGraph: {
      title,
      description,
      url: resolvedCanonicalPath,
      type: "website",
      locale: "ja_JP",
      siteName: "GritVib",
      images: avatarImage ? [{ url: avatarImage }] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: avatarImage ? [avatarImage] : undefined,
    },
  }
}

export default async function Page({ params, searchParams }: ProfilePageProps) {
  const { user_id } = await params
  await searchParams
  const identifier = user_id.trim()
  const profile = await resolveProfile(identifier)
  if (profile?.custom_id?.trim() && isUuid(identifier)) {
    permanentRedirect(`/profile/${encodeURIComponent(profile.custom_id.trim())}`)
  }
  return <ProfilePage resolvedProfileId={profile?.id} />
}
