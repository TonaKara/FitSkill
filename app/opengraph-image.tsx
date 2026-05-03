import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"

export const alt = "GritVib"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  const logoPath = path.join(process.cwd(), "public", "og-logo.png")
  const logo = await readFile(logoPath)
  const src = `data:image/png;base64,${logo.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
        <img src={src} alt="" width={280} height={280} />
        <div
          style={{
            marginTop: 28,
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <span style={{ color: "#c62828" }}>Grit</span>
          <span style={{ color: "#ffffff" }}>Vib</span>
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 26,
            color: "#a1a1aa",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          フィットネススキルのマーケットプレイス
        </div>
      </div>
    ),
    { ...size },
  )
}
