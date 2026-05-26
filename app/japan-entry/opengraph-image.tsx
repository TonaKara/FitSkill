import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"

/**
 * `/japan-entry` 専用の OGP。
 * - ヘッダー左側のロックアップ（オレンジタイル + "GritVib" + "Japan Entry Support"）と同一構成。
 * - 既存の `public/og-logo.png`（オレンジタイル + ブランドマーク）を <img> として埋め込み、隣にタイポを並べる。
 * - フォントは @vercel/og がバンドルしている既定の Geist Regular に任せる。
 *   （ImageResponse の `fonts` を指定しない場合、内蔵フォントで描画される）
 * - 余分な外部フォント fetch をしないことで、ビルド・配信時のネットワーク失敗を回避する。
 */

export const alt = "Japan Entry Support — Your Bridge to Japan | GritVib"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const logoPath = path.join(process.cwd(), "public", "og-logo.png")
  const logoData = await readFile(logoPath)
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          position: "relative",
        }}
      >
        {/* ヒーローセクションの放射状グラデと同調する、ブランドオレンジのソフトグロー（上部中央） */}
        <div
          style={{
            position: "absolute",
            top: -240,
            left: 0,
            right: 0,
            height: 640,
            display: "flex",
            background:
              "radial-gradient(ellipse at top, rgba(230,74,25,0.36), rgba(230,74,25,0) 65%)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 56,
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og の <img> は data URL 入力 */}
          <img src={logoSrc} alt="" width={300} height={300} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 180,
                fontWeight: 900,
                letterSpacing: -6,
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#e64a19" }}>Grit</span>
              <span style={{ color: "#ffffff" }}>Vib</span>
            </div>
            <div
              style={{
                marginTop: 22,
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: 10,
                color: "#a1a1aa",
              }}
            >
              JAPAN ENTRY SUPPORT
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
