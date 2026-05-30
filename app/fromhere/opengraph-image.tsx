import { ImageResponse } from "next/og"

import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/**
 * /fromhere の OGP 画像（ファイル規約: `app/.../opengraph-image.tsx`）。
 *
 * 内容: FromHere ヘッダー左側のブランドロックアップを 1200x630 に組み直したもの。
 *  - オレンジ角丸タイル + 白い "G" マーク（`src/app/components/BrandMarkSvg.tsx` と同じパス）
 *  - 「Grit」(オレンジ) + 「Vib」(黒) のロゴタイプ
 *  - 下段に "FROMHERE" サブラベル
 *
 * 設計メモ:
 *  - satori 上の日本語フォントを同梱しない方針なので、画像内テキストは英字のみで構成する。
 *    日本語のメタタイトル/説明は `<head>` 側 (`generateMetadata`) で出すので役割分担で問題ない。
 *  - `runtime` は明示せず Next.js 16 のデフォルト（nodejs）に任せる。
 */
export const alt = "FromHere by GritVib"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const ORANGE = "#e64a19"
const INK = "#0a0a0a"
const SUBTLE = "#71717a"
const BG = "#ffffff"

export default async function Image() {
  // alt テキストは i18n から取得（en/ja で同じ "FromHere by GritVib" を返す想定）。
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const ogAlt = lookupMessage(dict, "fromhere.metaOgAlt")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          position: "relative",
        }}
      >
        {/* 縁取り（薄いボーダー） */}
        <div
          style={{
            position: "absolute",
            inset: 24,
            borderRadius: 32,
            border: "2px solid #f4f4f5",
            display: "flex",
          }}
        />

        {/* ロックアップ：シンボル + GritVib + FROMHERE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
          }}
        >
          {/* オレンジタイル + 白いマーク */}
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: 44,
              background: ORANGE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 24px 60px rgba(230, 74, 25, 0.25)",
            }}
          >
            <svg
              viewBox="140 154 720 720"
              width="200"
              height="200"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g transform="translate(0 24) translate(500 513.875) scale(1.07) translate(-500 -513.875)">
                <polygon
                  fill="#000000"
                  points="766.38 256.39 705.86 359.43 738.47 359.43 798.73 256.39 766.38 256.39"
                />
                <polygon
                  fill="#000000"
                  points="688.38 359.43 749.95 256.39 717.34 256.39 656.03 359.43 688.38 359.43"
                />
                <polygon
                  fill="#000000"
                  points="638.55 359.43 699.34 256.39 666.21 256.39 604.64 359.43 638.55 359.43"
                />
                <path
                  fill="#ffffff"
                  d="M441.73,465.15h147.91l-89.61,156.33-165.91-284.28h174.13l-12.91,22.24h89.02l61.24-103.04c.2,0-444.33,0-444.33,0l305.41,514.96,221.48-388.37h-334.37l47.93,82.17Z"
                />
              </g>
            </svg>
          </div>

          {/* テキスト */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 168,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              <span style={{ color: ORANGE }}>Grit</span>
              <span style={{ color: INK }}>Vib</span>
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: 12,
                color: SUBTLE,
              }}
            >
              FROMHERE
            </div>
          </div>
        </div>

        {/* タグライン（英字でフォント問題を避ける） */}
        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            fontSize: 28,
            color: "#52525b",
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          {ogAlt}
        </div>
      </div>
    ),
    { ...size },
  )
}
