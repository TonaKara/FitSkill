import type { MetadataRoute } from "next"
import { buildSitemapEntryUrl, getSitemapBaseUrl } from "@/lib/site-seo"

export default function robots(): MetadataRoute.Robots {
  const site = getSitemapBaseUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/mypage",
        "/login",
        "/chat/",
        "/inquiry/",
        "/create-skill",
        "/profile-setup",
        "/maintenance",
      ],
    },
    sitemap: buildSitemapEntryUrl("/sitemap.xml"),
    host: site,
  }
}
