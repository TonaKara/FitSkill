/**
 * GritVib ブランド画像一括生成（ソース: scripts/brand-assets/logo-mark.svg = header.tsx と同一マーク）
 *
 * 出力: output/（作業用）＋ 以下へ同期
 * - public/apple-touch-icon.png（180×180、検索・ホーム画面用）
 * - public/og-logo.png（小アイコン用・赤角丸タイル＋白マーク＝ブランドロゴ）
 * - public/og-home.png（トップ OG のみ・1200×630・ヘッダー左上と同じ赤タイル＋マーク＋「Grit」「Vib」）
 * - app/favicon.ico, app/icon.png（タブ用）
 * - sns-icon-1080.png, favicon-32.png, favicon.ico, apple-touch-icon-180.png, header-1200x300.png
 */
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import sharp from "sharp"

const require = createRequire(import.meta.url)
const toIco = require("to-ico")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const ASSETS_DIR = path.join(__dirname, "brand-assets")
const OUT_DIR = path.join(ROOT, "output")
const PUBLIC_DIR = path.join(ROOT, "public")
const APP_DIR = path.join(ROOT, "app")

/** app/globals.css --brand-red / --primary */
const BRAND_RED = "#c62828"
const WHITE = "#ffffff"
const BLACK = "#000000"
/** app/globals ダーク背景に近い色（ヘッダー周りと揃える） */
const OG_SITE_BG = "#09090b"

function svgInnerContent(full) {
  const m = full.match(/<svg[^>]*>([\s\S]*)<\/svg>\s*$/i)
  return m ? m[1].trim() : full.trim()
}

async function loadMarkInnerWhite() {
  const raw = await fs.readFile(path.join(ASSETS_DIR, "logo-mark.svg"), "utf8")
  const white = raw.replace(/fill="currentColor"/g, 'fill="#ffffff"')
  return svgInnerContent(white)
}

function headerBannerSvg(markInner) {
  const W = 1200
  const H = 300
  const box = 220
  const x0 = 40
  const y0 = 40
  const rx = Math.round(box * 0.22)
  const pad = 14
  const inner = box - pad * 2
  const textX = x0 + box + 36
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BLACK}"/>
  <rect x="${x0}" y="${y0}" width="${box}" height="${box}" rx="${rx}" fill="${BRAND_RED}"/>
  <svg x="${x0 + pad}" y="${y0 + pad}" width="${inner}" height="${inner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
  <text
    x="${textX}"
    y="${H / 2}"
    font-size="84"
    font-weight="700"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    dominant-baseline="central"
  ><tspan fill="${BRAND_RED}">Grit</tspan><tspan fill="${WHITE}">Vib</tspan></text>
</svg>`
}

async function writePng(svgString, outPath, density = 300) {
  await sharp(Buffer.from(svgString, "utf8"), { density }).png().toFile(outPath)
}

async function main() {
  const markInner = await loadMarkInnerWhite()

  await fs.mkdir(OUT_DIR, { recursive: true })

  const snsSvg = (() => {
    const size = 1080
    const rx = Math.round(size * 0.225)
    const pad = Math.round(size * 0.083)
    const inner = size - pad * 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND_RED}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
</svg>`
  })()

  const appleSvg = (() => {
    const size = 180
    const rx = Math.round(size * 0.225)
    const pad = Math.round(size * 0.083)
    const inner = size - pad * 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND_RED}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
</svg>`
  })()

  const ogLogoSvg = (() => {
    const size = 560
    const rx = Math.round(size * 0.225)
    const pad = Math.round(size * 0.083)
    const inner = size - pad * 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND_RED}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
</svg>`
  })()

  const faviconBaseSvg = (() => {
    const size = 64
    const rx = Math.round(size * 0.225)
    const pad = Math.round(size * 0.083)
    const inner = size - pad * 2
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="${BRAND_RED}"/>
  <svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
    ${markInner}
  </svg>
</svg>`
  })()

  await writePng(snsSvg, path.join(OUT_DIR, "sns-icon-1080.png"), 144)
  const applePngPath = path.join(OUT_DIR, "apple-touch-icon-180.png")
  await sharp(Buffer.from(appleSvg, "utf8"), { density: 180 })
    .resize(180, 180)
    .png()
    .toFile(applePngPath)
  await fs.mkdir(PUBLIC_DIR, { recursive: true })
  await fs.copyFile(applePngPath, path.join(PUBLIC_DIR, "apple-touch-icon.png"))
  await writePng(ogLogoSvg, path.join(PUBLIC_DIR, "og-logo.png"), 144)

  /** トップ OGP 用：header.tsx のブランド（赤タイル＋BrandMarkSvg＋Grit赤/Vib白）を 1200×630 中央に配置 */
  const ogHomeSvg = (() => {
    const W = 1200
    const H = 630
    /** キャンバスいっぱいに近いロックアップ（余白は高さ 630 に合わせてタイルを最大化） */
    const tile = 420
    const rx = Math.round(tile * 0.2)
    const logoPad = Math.round(tile * 0.083)
    const logoInner = tile - logoPad * 2
    const gap = 14
    const fontPx = 132
    const approxTextW = 580
    const groupW = tile + gap + approxTextW
    const startX = Math.round((W - groupW) / 2)
    const tileY = Math.round((H - tile) / 2)
    const textX = startX + tile + gap
    const textY = Math.round(H / 2)
    const fontStack =
      "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${OG_SITE_BG}"/>
  <svg xmlns="http://www.w3.org/2000/svg" x="${startX}" y="${tileY}" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">
    <rect width="${tile}" height="${tile}" rx="${rx}" fill="${BRAND_RED}"/>
    <svg x="${logoPad}" y="${logoPad}" width="${logoInner}" height="${logoInner}" viewBox="140 154 720 720" preserveAspectRatio="xMidYMid meet">
${markInner}
    </svg>
  </svg>
  <text xml:space="preserve" x="${textX}" y="${textY}" font-size="${fontPx}" font-weight="700" font-family="${fontStack}" dominant-baseline="central">
    <tspan fill="${BRAND_RED}">Grit</tspan><tspan fill="${WHITE}">Vib</tspan>
  </text>
</svg>`
  })()
  await writePng(ogHomeSvg, path.join(PUBLIC_DIR, "og-home.png"), 144)
  await writePng(headerBannerSvg(markInner), path.join(OUT_DIR, "header-1200x300.png"), 144)

  const favicon32 = await sharp(Buffer.from(faviconBaseSvg, "utf8"), { density: 256 })
    .resize(32, 32)
    .png()
    .toBuffer()
  await fs.writeFile(path.join(OUT_DIR, "favicon-32.png"), favicon32)

  const favicon16 = await sharp(Buffer.from(faviconBaseSvg, "utf8"), { density: 256 })
    .resize(16, 16)
    .png()
    .toBuffer()
  const icoBuf = await toIco([favicon16, favicon32])
  await fs.writeFile(path.join(OUT_DIR, "favicon.ico"), icoBuf)
  await fs.writeFile(path.join(APP_DIR, "favicon.ico"), icoBuf)
  await fs.writeFile(path.join(APP_DIR, "icon.png"), favicon32)

  console.log(`Wrote brand assets to ${OUT_DIR}, synced public/apple-touch-icon.png and app favicon/icon`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
