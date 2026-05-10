import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site-seo"

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl().replace(/\/$/, "")
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
    sitemap: `${site}/sitemap.xml`,
    host: site,
  }
}
