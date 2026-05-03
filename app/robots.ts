import type { MetadataRoute } from "next"

const SITE = "https://gritvib.com"

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  }
}
