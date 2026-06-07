import type { MetadataRoute } from "next"
import { LAYOUT_DESCRIPTION } from "@/lib/site-seo"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HITO",
    short_name: "HITO",
    description: LAYOUT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
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
