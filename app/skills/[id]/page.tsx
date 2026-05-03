import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import SkillPage from "@/skills/[id]/page"

type SkillPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const SITE = "https://gritvib.com"

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
  if (!url || !key) {
    return { title: "スキル" }
  }
  const supabase = createClient(url, key)
  const { data } = await supabase
    .from("skills")
    .select("title, description, is_published, thumbnail_url")
    .eq("id", id)
    .maybeSingle()

  if (!data || data.is_published === false) {
    return {
      title: "スキル",
      robots: { index: false, follow: true },
    }
  }

  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : "スキル"
  const description = truncateDescription(typeof data.description === "string" ? data.description : null)
  const thumb =
    typeof data.thumbnail_url === "string" && data.thumbnail_url.trim().length > 0
      ? data.thumbnail_url.trim()
      : null

  const shareImages = thumb ? [{ url: thumb, alt: title }] : [`${SITE}/opengraph-image`]

  return {
    title,
    description,
    alternates: { canonical: `/skills/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE}/skills/${id}`,
      type: "website",
      locale: "ja_JP",
      siteName: "GritVib",
      images: shareImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: shareImages.map((entry) => (typeof entry === "string" ? entry : entry.url)),
    },
  }
}

export default async function Page({ params, searchParams }: SkillPageProps) {
  await params
  await searchParams
  return <SkillPage />
}
