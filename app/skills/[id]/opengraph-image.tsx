import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const alt = "GritVib スキル詳細"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type OgProps = {
  params: Promise<{ id: string }>
}

function toDataUrl(buf: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buf.toString("base64")}`
}

function clipText(value: string, max = 58): string {
  const t = value.trim()
  if (t.length <= max) {
    return t
  }
  return `${t.slice(0, max - 1)}…`
}

export default async function OpenGraphImage({ params }: OgProps) {
  const { id } = await params
  const faviconPath = path.join(process.cwd(), "public", "favicon.svg")
  const faviconSvg = await readFile(faviconPath, "utf8")
  const faviconSrc = toDataUrl(Buffer.from(faviconSvg), "image/svg+xml")

  let skillTitle = "GritVib スキル"
  let thumbnailUrl: string | null = null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && key) {
    const supabase = createClient(url, key)
    const { data } = await supabase
      .from("skills")
      .select("title, thumbnail_url, is_published")
      .eq("id", id)
      .maybeSingle()
    if (data && data.is_published !== false) {
      if (typeof data.title === "string" && data.title.trim().length > 0) {
        skillTitle = clipText(data.title)
      }
      if (typeof data.thumbnail_url === "string" && data.thumbnail_url.trim().length > 0) {
        thumbnailUrl = data.thumbnail_url.trim()
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: "#121212",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
        }}
      >
        <div
          style={{
            width: 600,
            height: 630,
            display: "flex",
            alignItems: "stretch",
            justifyContent: "stretch",
            backgroundColor: "#0b0b0b",
          }}
        >
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori
            <img src={thumbnailUrl} alt="" width={600} height={630} style={{ objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f5f5f5",
                fontSize: 42,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                background:
                  "linear-gradient(145deg, #1a1a1a 0%, #111111 45%, #5a1515 100%)",
              }}
            >
              GritVib
            </div>
          )}
        </div>

        <div
          style={{
            width: 600,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#121212",
            padding: "56px 52px 44px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#c62828",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              SKILL DETAIL
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                color: "#ffffff",
                fontSize: 58,
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.03em",
                whiteSpace: "pre-wrap",
              }}
            >
              {skillTitle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
            <img src={faviconSrc} alt="" width={54} height={54} />
            <div style={{ display: "flex", fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em" }}>
              <span style={{ color: "#c62828" }}>Grit</span>
              <span style={{ color: "#ffffff" }}>Vib</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
