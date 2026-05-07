import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import { SITE_URL } from "@/lib/site-seo"

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const pagePath = `/skills/${id}`
  const ogImage = `${SITE_URL}${pagePath}/opengraph-image`

  if (!url || !key) {
    return {
      title: "スキル",
      description: "GritVibで提供中のスキルです。",
      alternates: { canonical: pagePath },
      robots: { index: false, follow: true },
      openGraph: {
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        url: pagePath,
        type: "website",
        locale: "ja_JP",
        siteName: "GritVib",
        images: [{ url: ogImage, alt: "GritVib Skill OGP" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        images: [ogImage],
      },
    }
  }

  const supabase = createClient(url, key)
  const { data } = await supabase.from("skills").select("title, description, is_published").eq("id", id).maybeSingle()

  if (!data || data.is_published === false) {
    return {
      title: "スキル",
      description: "GritVibで提供中のスキルです。",
      alternates: { canonical: pagePath },
      robots: { index: false, follow: true },
      openGraph: {
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        url: pagePath,
        type: "website",
        locale: "ja_JP",
        siteName: "GritVib",
        images: [{ url: ogImage, alt: "GritVib Skill OGP" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "スキル",
        description: "GritVibで提供中のスキルです。",
        images: [ogImage],
      },
    }
  }

  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "スキル"
  const description = truncateDescription(typeof data.description === "string" ? data.description : null)

  return {
    title,
    description,
    alternates: { canonical: pagePath },
    openGraph: {
      title,
      description,
      url: pagePath,
      type: "website",
      locale: "ja_JP",
      siteName: "GritVib",
      images: [{ url: ogImage, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function SkillLayout({ children, params }: SkillLayoutProps) {
  await params
  return <>{children}</>
}
