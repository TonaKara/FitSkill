import type { MetadataRoute } from "next"
import { fetchPublishedSkillIds } from "../src/lib/published-skill-ids"

/** Supabase 等 Node API を安全に使う（Edge だと生成失敗して HTML エラーになることがある） */
export const runtime = "nodejs"

const SITE = "https://gritvib.com"

function staticEntries(lastModified: Date): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/guide`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE}/contact`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/legal/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/legal/privacy-policy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${SITE}/legal/specified-commercial-transactions`,
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
      url: `${SITE}/skills/${id}`,
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
