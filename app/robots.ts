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
        "/talk/admin",
        "/talk/chat",
        "/talk/login",
        "/talk/register",
        "/talk/onboard",
        "/talk/checkout",
        "/talk/settings/",
        "/mypage",
        "/login",
        "/chat/",
        "/inquiry/",
        "/create-skill",
        "/profile-setup",
        "/maintenance",
        "/landing-preview",
      ],
    },
    sitemap: buildSitemapEntryUrl("/sitemap.xml"),
    host: site,
  }
}
