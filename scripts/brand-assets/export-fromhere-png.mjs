/**
 * `public/fromhere-logo.svg` と `public/fromhere-mark.svg` を PNG に書き出す。
 *
 * 利用ライブラリ: `@resvg/resvg-js` (Rust 製 resvg の Node バインディング)。
 * - SVG を高精度でラスタライズできる。`fitTo` でターゲット解像度を直接指定する。
 * - フォントはシステムフォントを参照する (`font.loadSystemFonts: true`)。
 *   日本語フォントは使っていない (英字のみ) ため、Windows / macOS / Linux いずれでも
 *   見た目に大きな差は出ない想定。
 *
 * 実行:
 *   node scripts/brand-assets/export-fromhere-png.mjs
 */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Resvg } from "@resvg/resvg-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..", "..")
const publicDir = path.join(repoRoot, "public")

/**
 * 出力対象。
 *
 * `fitTo` には SVG 元寸法に対するスケール基準を指定する。横長ロックアップは
 *   `width` 基準、正方形マークは `width` 基準で良い (高さは自動で追従)。
 */
const targets = [
  {
    inputSvg: "fromhere-logo.svg",
    outputs: [
      { name: "fromhere-logo.png", width: 1200 },
      { name: "fromhere-logo@2x.png", width: 2400 },
    ],
  },
  {
    inputSvg: "fromhere-mark.svg",
    outputs: [
      { name: "fromhere-mark.png", width: 512 },
      { name: "fromhere-mark@2x.png", width: 1024 },
    ],
  },
  {
    inputSvg: "fromhere-banner.svg",
    outputs: [
      { name: "fromhere-banner.png", width: 2400 },
    ],
  },
]

for (const target of targets) {
  const svgPath = path.join(publicDir, target.inputSvg)
  const svgString = await readFile(svgPath, "utf8")
  for (const out of target.outputs) {
    const resvg = new Resvg(svgString, {
      fitTo: { mode: "width", value: out.width },
      background: "rgba(0,0,0,0)",
      font: {
        loadSystemFonts: true,
        defaultFontFamily: "Arial",
      },
      logLevel: "warn",
    })
    const pngBuffer = resvg.render().asPng()
    const outPath = path.join(publicDir, out.name)
    await writeFile(outPath, pngBuffer)
    console.log(`[fromhere] wrote ${path.relative(repoRoot, outPath)} (width=${out.width})`)
  }
}
