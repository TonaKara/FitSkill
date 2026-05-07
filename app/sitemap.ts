import type { MetadataRoute } from "next"
import { fetchPublishedSkillIds } from "../src/lib/published-skill-ids"
import { SITE_URL } from "@/lib/site-seo"

/** Supabase 等 Node API を安全に使う（Edge だと生成失敗して HTML エラーになることがある） */
export const runtime = "nodejs"

function staticEntries(lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guide`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/contact`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/legal/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy-policy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${SITE_URL}/legal/specified-commercial-transactions`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const base = staticEntries(lastModified)

  try {
    const skillIds = await fetchPublishedSkillIds()
    const skillUrls: MetadataRoute.Sitemap = skillIds.map((id) => ({
      url: `${SITE_URL}/skills/${id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }))
    return [...base, ...skillUrls]
  } catch (err) {
    console.error("[sitemap] failed to append skill URLs:", err)
    return base
  }
}
