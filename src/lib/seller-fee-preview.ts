/** 出品スキル販売時の手数料率（利用規約と一致） */
export const SELLER_FEE_RATE = 0.15

export type SellerFeePreview = {
  /** 切り上げ後の受取額（円） */
  receiveYen: number
  /** 販売価格（円・整数部）− 受取額 */
  feeYen: number
}

/**
 * 販売価格（円・整数部）に対し、受取額 = Math.ceil(価格 × (1 − 15%))。手数料は価格との差分。
 */
export function computeSellerFeePreview(salePriceYen: number): SellerFeePreview | null {
  if (!Number.isFinite(salePriceYen) || salePriceYen <= 0) {
    return null
  }
  const saleYen = Math.trunc(salePriceYen)
  if (saleYen < 1) {
    return null
  }
  const receiveYen = Math.ceil(saleYen * (1 - SELLER_FEE_RATE))
  const feeYen = saleYen - receiveYen
  return { receiveYen, feeYen }
}
