import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"
import {
  GRITVIB_LANDING_OG_IMAGE_SIZE,
  GRITVIB_LANDING_TITLE_ABSOLUTE,
} from "@/lib/site-seo"

const { width: OG_WIDTH, height: OG_HEIGHT } = GRITVIB_LANDING_OG_IMAGE_SIZE

export const runtime = "nodejs"

/** トップ OG。`public/og-gritvib-landing.png`（1200×630）をそのまま配信 */
export const alt = GRITVIB_LANDING_TITLE_ABSOLUTE
export const size = GRITVIB_LANDING_OG_IMAGE_SIZE
export const contentType = "image/png"

const OG_FILENAME = "og-gritvib-landing.png"

export default async function OpenGraphImage() {
  const ogHomePath = path.join(process.cwd(), "public", OG_FILENAME)
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
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img
          src={src}
          alt=""
          width={GRITVIB_LANDING_OG_IMAGE_SIZE.width}
          height={GRITVIB_LANDING_OG_IMAGE_SIZE.height}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size },
  )
}
