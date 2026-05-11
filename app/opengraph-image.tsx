import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"
import { HOME_TITLE_ABSOLUTE } from "@/lib/site-seo"

export const runtime = "nodejs"

/** トップ以外の既定 OG。`public/og-home.png`（ヘッダー左上と同じロックアップ）を全画面で使用 */
export const alt = HOME_TITLE_ABSOLUTE
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  const ogHomePath = path.join(process.cwd(), "public", "og-home.png")
  const ogHome = await readFile(ogHomePath)
  const src = `data:image/png;base64,${ogHome.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img src={src} alt="" width={1200} height={630} style={{ objectFit: "cover" }} />
      </div>
    ),
    { ...size },
  )
}
