/**
 * Twitter Card 用 OGP。
 * Open Graph の og:image をそのまま `twitter:image` としても露出させたいので、
 * `opengraph-image.tsx` の default export と設定をそのまま再エクスポートする。
 */
export { default, alt, size, contentType, runtime } from "./opengraph-image"
