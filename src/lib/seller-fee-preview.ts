/** 出品スキル販売時の手数料率（利用規約と一致） */
export const SELLER_FEE_RATE = 0.15

/**
 * 手数料・受取額のプレビュー。
 *
 * # 通貨非依存
 * 内部演算は単位非依存の integer 計算（Math.trunc / Math.ceil）なので、
 * 入力が「DB の price 列（= currency の最小単位 integer）」であれば、
 * 任意の通貨（JPY=yen, USD=cents 等）でそのまま使える。
 *
 * 命名上 `*Yen` が残っているのは歴史的経緯で、実体は「最小単位 integer」。
 */
export type SellerFeePreview = {
  /** 切り上げ後の受取額（行の通貨の最小単位 integer） */
  receiveYen: number
  /** 販売価格（行の通貨の最小単位 integer）− 受取額 */
  feeYen: number
}

/**
 * 販売価格（行の通貨の最小単位 integer）から、受取額 = Math.ceil(価格 × (1 − 15%))。
 * 手数料は価格との差分。
 *
 * 例:
 * - JPY: 1000 (= ¥1,000) → receive=850, fee=150
 * - USD: 1000 (= $10.00, 1000 cents) → receive=850 (= $8.50), fee=150 (= $1.50)
 */
export function computeSellerFeePreview(salePriceMinor: number): SellerFeePreview | null {
  if (!Number.isFinite(salePriceMinor) || salePriceMinor <= 0) {
    return null
  }
  const saleMinor = Math.trunc(salePriceMinor)
  if (saleMinor < 1) {
    return null
  }
  const receiveYen = Math.ceil(saleMinor * (1 - SELLER_FEE_RATE))
  const feeYen = saleMinor - receiveYen
  return { receiveYen, feeYen }
}

/** 販売価格から講師の受取額を算出（最小単位）。無効な価格は 0。 */
export function computeSellerReceiveYen(salePriceMinor: number): number {
  return computeSellerFeePreview(salePriceMinor)?.receiveYen ?? 0
}
