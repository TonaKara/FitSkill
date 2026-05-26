/**
 * GritVib ロゴロックアップ（透過背景）画像を1枚だけ生成するスクリプト。
 *
 * - 出力: public/logo-lockup-transparent.png (1200×400, 透過 PNG)
 * - レイアウトはトップページヘッダー左側のロックアップに揃える:
 *   - オレンジ角丸タイル + 内側にホワイト「G」マーク + ブラック3本線
 *   - "Grit" = brand orange (#e64a19), "Vib" = WHITE (#ffffff)
 * - 既存の generate-brand-assets.mjs / 既存ブランドアセットには一切手を入れない。
 *   このスクリプトは新規 1 ファイルのみを書き出す（追加用途）。
 */
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const ASSETS_DIR = path.join(__dirname, "brand-assets")
const PUBLIC_DIR = path.join(ROOT, "public")

/** app/globals.css --brand-red / --primary と一致させる */
const BRAND_RED = "#e64a19"
const WHITE = "#ffffff"

function svgInnerContent(full) {
  const m = full.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/i)
  return m ? m[1].trim() : full.trim()
}

async function main() {
  const markInner = svgInnerContent(
    await fs.readFile(path.join(ASSETS_DIR, "logo-mark.svg"), "utf8"),
  )

  /**
   * 1200×400 / 透過背景。
   *
   * 寸法・比率は generate-brand-assets.mjs の `ogHomeSvg` と同じ ref ベースで算出し、
   * ヘッダー（h-10 タイル + text-xl GritVib）の見た目に合うようキープ。
   *
   *   refTile / refMark / refRx ... タイルとマーク・角丸の基準比
   *   refFont / refApproxWordmark / textPullRef ... GritVib テキストの基準サイズと光学微調整
   */
  const W = 1200
  const H = 400
  const refTile = 40
  const refMark = 36
  const refRx = 10
  const refGap = 0
  const textPullRef = 19
  const refFont = 20
  const refApproxWordmark = 94
  const insetPad = (refTile - refMark) / 2

  const groupWRef = refTile + refGap + refApproxWordmark - textPullRef
  const groupH = refTile
  const marginPx = 56
  const s = Math.min(
    (W - 2 * marginPx) / groupWRef,
    (H - 2 * marginPx) / groupH,
  )

  const tile = refTile * s
  const rx = refRx * s
  const logoPad = insetPad * s
  const logoInner = refMark * s
  const gap = refGap * s
  const pull = textPullRef * s
  const fontPx = refFont * s

  const scaledGroupW = tile + gap + refApproxWordmark * s - pull
  const startX = (W - scaledGroupW) / 2
  const tileY = (H - tile) / 2
  const textX = startX + tile + gap - pull
  const textY = H / 2

  const fontStack =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

  // 背景 rect を入れないことで透過 PNG として書き出される。
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <svg xmlns="http://www.w3.org/2000/svg" x="${startX}" y="${tileY}" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">
    <rect width="${tile}" height="${tile}" rx="${rx}" fill="${BRAND_RED}"/>
    <svg x="${logoPad}" y="${logoPad}" width="${logoInner}" height="${logoInner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
${markInner}
    </svg>
  </svg>
  <text text-anchor="start" xml:space="preserve" x="${textX}" y="${textY}" font-size="${fontPx}" font-weight="700" font-family="${fontStack}" letter-spacing="-0.025em" dominant-baseline="central">
    <tspan fill="${BRAND_RED}">Grit</tspan><tspan fill="${WHITE}">Vib</tspan>
  </text>
</svg>`

  await fs.mkdir(PUBLIC_DIR, { recursive: true })
  const outPath = path.join(PUBLIC_DIR, "logo-lockup-transparent.png")
  await sharp(Buffer.from(svg, "utf8"), { density: 144 })
    .png()
    .toFile(outPath)

  console.log(`Wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
