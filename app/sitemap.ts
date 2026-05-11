import type { MetadataRoute } from "next"
import { fetchPublishedSkillIds } from "../src/lib/published-skill-ids"
import { buildSitemapEntryUrl } from "@/lib/site-seo"

/** Supabase 等 Node API を安全に使う（Edge だと生成失敗して HTML エラーになることがある） */
export const runtime = "nodejs"

function staticEntries(lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: buildSitemapEntryUrl("/"), lastModified, changeFrequency: "daily", priority: 1 },
    { url: buildSitemapEntryUrl("/about"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: buildSitemapEntryUrl("/guide"), lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: buildSitemapEntryUrl("/contact"), lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: buildSitemapEntryUrl("/legal/terms"), lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: buildSitemapEntryUrl("/legal/privacy-policy"), lastModified, changeFrequency: "yearly", priority: 0.3 },
    {
      url: buildSitemapEntryUrl("/legal/specified-commercial-transactions"),
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
      url: buildSitemapEntryUrl(`/skills/${id}`),
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
