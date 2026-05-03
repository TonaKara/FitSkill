import type { MetadataRoute } from "next"
import { fetchPublishedSkillIds } from "@/lib/published-skill-ids"

const SITE = "https://gritvib.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
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

  const skillIds = await fetchPublishedSkillIds()
  const skillEntries: MetadataRoute.Sitemap = skillIds.map((id) => ({
    url: `${SITE}/skills/${id}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }))

  return [...staticEntries, ...skillEntries]
}
