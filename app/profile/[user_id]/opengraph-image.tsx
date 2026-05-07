import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"
import { isUuid, normalizeCustomId } from "@/lib/profile-path"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"

export const runtime = "nodejs"
export const revalidate = 0
export const alt = "GritVib ユーザープロフィール"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type OgProps = {
  params: Promise<{ user_id: string }>
}

function clipText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length === 0) {
    return ""
  }
  if (text.length <= max) {
    return text
  }
  return `${text.slice(0, max - 1)}…`
}

export default async function OpenGraphImage({ params }: OgProps) {
  const { user_id } = await params
  const identifier = user_id.trim()
  const normalizedCustomId = normalizeCustomId(identifier)
  const fallbackName = "GritVib User"
  const fallbackBio = "GritVibで活動するユーザーのプロフィールページです。"

  let displayName = fallbackName
  let bioExcerpt = fallbackBio
  let avatarUrl: string | null = null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    let resolvedProfileId = identifier
    if (!isUuid(identifier)) {
      const { data: idRow } = await supabase
        .from("profiles")
        .select("id")
        .eq("custom_id", normalizedCustomId)
        .maybeSingle()
      if (typeof idRow?.id === "string" && idRow.id.trim().length > 0) {
        resolvedProfileId = idRow.id
      }
    }

    const { data } = await supabase
      .from("profiles_public")
      .select("display_name, bio, avatar_url")
      .eq("id", resolvedProfileId)
      .maybeSingle()

    if (typeof data?.display_name === "string" && data.display_name.trim().length > 0) {
      displayName = clipText(data.display_name, 26)
    }
    if (typeof data?.bio === "string" && data.bio.trim().length > 0) {
      bioExcerpt = clipText(data.bio, 120)
    }
    if (typeof data?.avatar_url === "string" && data.avatar_url.trim().length > 0) {
      avatarUrl = data.avatar_url.trim()
    }
  }

  const avatarSrc = resolveProfileAvatarUrl(avatarUrl, displayName)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#070707",
          color: "#ffffff",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif',
        }}
      >
        <div
          style={{
            width: 480,
            height: 630,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(circle at 18% 20%, rgba(198,40,40,0.55), transparent 50%), linear-gradient(145deg, #101010 0%, #030303 70%)",
            borderRight: "1px solid rgba(198, 40, 40, 0.45)",
          }}
        >
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 9999,
              overflow: "hidden",
              border: "5px solid rgba(198, 40, 40, 0.95)",
              boxShadow: "0 0 80px rgba(198, 40, 40, 0.45)",
              display: "flex",
              backgroundColor: "#111111",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse / Satori */}
            <img src={avatarSrc} alt="" width={300} height={300} style={{ objectFit: "cover" }} />
          </div>
        </div>

        <div
          style={{
            width: 720,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "68px 58px 54px",
            background:
              "linear-gradient(160deg, rgba(198,40,40,0.18) 0%, rgba(8,8,8,0) 45%), linear-gradient(180deg, #0c0c0c 0%, #050505 100%)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "#ef4444",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.1em",
              }}
            >
              PROFILE CARD
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.03em",
                color: "#ffffff",
                whiteSpace: "pre-wrap",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 28,
                paddingTop: 24,
                borderTop: "1px solid rgba(239,68,68,0.45)",
                color: "#d4d4d8",
                fontSize: 29,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
              }}
            >
              {bioExcerpt}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#ef4444",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              gritvib.com
            </div>
            <div style={{ display: "flex", fontSize: 46, fontWeight: 800, letterSpacing: "-0.03em" }}>
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
