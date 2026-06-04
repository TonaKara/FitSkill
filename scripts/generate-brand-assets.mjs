/**
 * `scripts/brand/favicon-source.png` からファビコン一式を生成する。
 * 実行: npm run generate:brand-assets
 *
 * タブ用 .ico は 16px でも潰れないよう、余白トリム後に同一パイプラインで縮小する。
 */
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"
import toIco from "to-ico"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")
const source = path.join(root, "scripts", "brand", "favicon-source.png")

const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 }

/** 透明余白を除いてから正方形に収め、全サイズで同じ見え方にする。 */
async function renderSquarePng(size) {
  return sharp(source)
    .trim({ threshold: 12 })
    .resize(size, size, {
      fit: "contain",
      background: WHITE_BG,
      kernel: sharp.kernel.lanczos3,
    })
    .flatten({ background: WHITE_BG })
    .ensureAlpha()
    .png()
    .toBuffer()
}

/** to-ico は RGBA 前提。RGB のままだと BMP 化で斜線ノイズになる。 */
async function writeIcoFromPng(png32) {
  const sizes = [16, 32, 48]
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp(png32)
        .resize(size, size, { kernel: sharp.kernel.lanczos3 })
        .ensureAlpha()
        .png()
        .toBuffer(),
    ),
  )
  const ico = await toIco(buffers)
  for (const relativeDest of ["public/favicon.ico", "app/favicon.ico"]) {
    const dest = path.join(root, relativeDest)
    await fs.writeFile(dest, ico)
    console.log(`wrote ${relativeDest} (${ico.length} bytes)`)
  }
}

async function writePngFromBuffer(buffer, relativeDest) {
  const dest = path.join(root, relativeDest)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, buffer)
  const meta = await sharp(buffer).metadata()
  console.log(`wrote ${relativeDest} (${meta.width}x${meta.height})`)
}

async function main() {
  await fs.access(source)

  const png512 = await renderSquarePng(512)
  const png180 = await renderSquarePng(180)
  const png32 = await renderSquarePng(32)

  await writePngFromBuffer(png512, "public/icon-512.png")
  await writePngFromBuffer(png180, "public/apple-touch-icon.png")
  await writePngFromBuffer(png32, "public/favicon-32.png")
  await writePngFromBuffer(png32, "app/icon.png")
  await writeIcoFromPng(png32)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
