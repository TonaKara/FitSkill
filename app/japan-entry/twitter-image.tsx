/**
 * Twitter Card 用 OGP。
 * Open Graph の og:image をそのまま `twitter:image` としても露出させたいので、
 * `opengraph-image.tsx` の default export と画像メタデータをそのまま再エクスポートする。
 *
 * `runtime` は Next.js の静的解析で各ファイルに直接書かれている必要があるため
 * （再エクスポートでは "can't recognize the exported `runtime` field" 警告となる）、
 * ここで明示的に宣言する。
 */
export const runtime = "nodejs"

export { default, alt, size, contentType } from "./opengraph-image"
