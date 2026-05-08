import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { getSiteUrl } from "@/lib/site-seo"

type SkillLayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

function truncateDescription(raw: string | null | undefined, max = 160): string {
  if (raw == null || raw.trim().length === 0) {
    return "GritVibで提供中のスキルです。"
  }
  const t = raw.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  /** プロフィールの generateMetadata と同様。クローラ向けメタデータには JWT が無いため、OG 用はサービスロールで読むと RLS で anon が読めない場合でも DB と一致する */
  const dbKey = serviceKey ?? anonKey
  const pagePath = `/skills/${id}`
  const siteBase = getSiteUrl().replace(/\/$/, "")
  const absolutePageUrl = `${siteBase}${pagePath}`
  /** og:image は同一オリジンのプロキシのみ参照（Discord 等が Storage URL を取りに行けない対策）。画像バイトは /api/og/skill/[id] が DB の thumbnail_url から取得 */
  const ogImageUrl = `${siteBase}/api/og/skill/${encodeURIComponent(id)}`

  if (!supabaseUrl || !dbKey) {
    return {
      title: "スキル",
      description: "GritVibで提供中のスキルです。",
      alternates: { canonical: absolutePageUrl },
      robots: { index: false, follow: true },
      openGraph: {
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        url: absolutePageUrl,
        type: "website",
        locale: "ja_JP",
        siteName: "GritVib",
        images: [{ url: ogImageUrl, alt: "GritVib Skill OGP" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        images: [ogImageUrl],
      },
    }
  }

  const supabase = createClient(supabaseUrl, dbKey)
  const { data, error } = await supabase
    .from("skills")
    .select("title, description, is_published")
    .eq("id", id)
    .maybeSingle()

  /** DB エラー・該当なし・未公開はクローラ向けにプレースホルダ（ページ本体は所有者のみ未公開を閲覧可）。画像は API がデフォルト PNG を返す */
  if (error || !data || data.is_published === false) {
    return {
      title: "スキル",
      description: "GritVibで提供中のスキルです。",
      alternates: { canonical: absolutePageUrl },
      robots: { index: false, follow: true },
      openGraph: {
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        url: absolutePageUrl,
        type: "website",
        locale: "ja_JP",
        siteName: "GritVib",
        images: [{ url: ogImageUrl, alt: "GritVib Skill OGP" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        images: [ogImageUrl],
      },
    }
  }

  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "スキル"
  const description = truncateDescription(typeof data.description === "string" ? data.description : null)

  return {
    title,
    description,
    alternates: { canonical: absolutePageUrl },
    openGraph: {
      title,
      description,
      url: absolutePageUrl,
      type: "website",
      locale: "ja_JP",
      siteName: "GritVib",
      images: [{ url: ogImageUrl, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function SkillLayout({ children, params }: SkillLayoutProps) {
  await params
  return <>{children}</>
}
