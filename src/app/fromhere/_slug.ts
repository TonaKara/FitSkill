/**
 * FromHere プロダクトの slug 生成。
 *
 * - title から URL セーフな slug を生成する。日本語は ASCII の英数字 / ハイフンしか含めない
 *   仕様にし、空になった場合は接頭辞 `product-` + ランダム接尾辞でフォールバックする。
 * - DB 側の CHECK 制約 `^[a-z0-9-]{1,80}$` と一致させる。
 * - 衝突回避は呼び出し側（API）でサーバー側 SELECT して `-2`, `-3` ... と付与する。
 */

const MAX_SLUG_LENGTH = 80

/**
 * 文字列を slug に正規化する。
 * - NFKD 正規化＋アクセント除去
 * - ASCII 英数字とハイフン以外を `-` に置換
 * - 連続ハイフン圧縮
 * - 先頭末尾のハイフン除去
 * - 最大長制限
 */
export function buildBaseSlug(title: string): string {
  const normalized = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

  const ascii = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, MAX_SLUG_LENGTH)

  if (ascii.length === 0) {
    return ""
  }
  return ascii
}

/** ベース slug + 連番（`-2`, `-3` …）を生成。max 長を超えないよう base を切り詰める */
export function buildSlugWithSuffix(base: string, suffix: number): string {
  if (suffix <= 1) {
    return base
  }
  const suffixStr = `-${suffix}`
  const room = MAX_SLUG_LENGTH - suffixStr.length
  const trimmed = base.slice(0, Math.max(1, room)).replace(/-+$/g, "")
  return `${trimmed || "product"}${suffixStr}`
}

/** ランダム接尾辞 (`-abc123`) の生成（base が空 / 競合過多時のフォールバック） */
export function buildRandomFallbackSlug(base: string, randomBytes: () => string): string {
  const rand = randomBytes().slice(0, 6)
  const safeBase = (base || "product").slice(0, MAX_SLUG_LENGTH - rand.length - 1).replace(/-+$/g, "")
  return `${safeBase || "product"}-${rand}`
}

export const FROMHERE_SLUG_MAX_LENGTH = MAX_SLUG_LENGTH
export const FROMHERE_SLUG_REGEX = /^[a-z0-9-]{1,80}$/
