/**
 * `scripts/brand/favicon-source.png` からファビコン一式を生成する。
 * 実行: npm run generate:brand-assets
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

async function writePng(size, relativeDest) {
  const dest = path.join(root, relativeDest)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await sharp(source)
    .resize(size, size, { fit: "contain", background: WHITE_BG })
    .png()
    .toFile(dest)
  console.log(`wrote ${relativeDest} (${size}x${size})`)
}

async function writeIco() {
  const sizes = [16, 32, 48]
  const buffers = await Promise.all(
    sizes.map((size) =>
      sharp(source)
        .resize(size, size, { fit: "contain", background: WHITE_BG })
        .png()
        .toBuffer(),
    ),
  )
  const ico = await toIco(buffers)
  for (const relativeDest of ["public/favicon.ico", "app/favicon.ico"]) {
    const dest = path.join(root, relativeDest)
    await fs.writeFile(dest, ico)
    console.log(`wrote ${relativeDest}`)
  }
}

async function main() {
  await fs.access(source)
  await writePng(512, "public/icon-512.png")
  await writePng(180, "public/apple-touch-icon.png")
  await writePng(32, "app/icon.png")
  await writeIco()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
