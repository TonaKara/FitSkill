import type { MetadataRoute } from "next"
import { fetchPublishedSkillIds } from "../src/lib/published-skill-ids"
import { getSiteUrl } from "@/lib/site-seo"

/** Supabase 等 Node API を安全に使う（Edge だと生成失敗して HTML エラーになることがある） */
export const runtime = "nodejs"

function staticEntries(site: string, lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: site, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${site}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/guide`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${site}/contact`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site}/legal/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/legal/privacy-policy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${site}/legal/specified-commercial-transactions`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl().replace(/\/$/, "")
  const lastModified = new Date()
  const base = staticEntries(site, lastModified)

  try {
    const skillIds = await fetchPublishedSkillIds()
    const skillUrls: MetadataRoute.Sitemap = skillIds.map((id) => ({
      url: `${site}/skills/${id}`,
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
