import type { MetadataRoute } from "next"
import { LAYOUT_DESCRIPTION } from "@/lib/site-seo"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GritVib",
    short_name: "GritVib",
    description: LAYOUT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#e64a19",
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
