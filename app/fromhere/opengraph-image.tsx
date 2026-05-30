import { readFile } from "fs/promises"
import path from "path"
import { ImageResponse } from "next/og"

export const runtime = "nodejs"

/**
 * /fromhere の OGP 画像（ファイル規約: `app/.../opengraph-image.tsx`）。
 *
 * 本体トップ (`app/opengraph-image.tsx`) と同じ意匠を共有するため、`public/og-home.png`
 * をそのまま 1200x630 のキャンバスに敷き詰めて返す。FromHere 専用に「タイル + GritVib +
 * FROMHERE」のオリジナルロックアップを描画していた以前の実装は、本体 OGP との一貫性
 * (ブランド体験の統一) を優先して撤廃した。
 *
 * 注意:
 * - `opengraph-image.tsx` はファイル規約上、所属する route segment にしか自動継承され
 *   ないため、サブセグメント (`/fromhere/u/[handle]`, `/fromhere/p/[slug]` 等) の OGP は
 *   それぞれの `generateMetadata` 側で別途指定している (個別の OGP を維持する設計)。
 *   本ファイルは `/fromhere` ルート専用。
 */
export const alt = "FromHere by GritVib"
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
