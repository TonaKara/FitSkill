import { computeSellerReceiveYen } from "@/lib/seller-fee-preview"

export type MonthlySalesPoint = {
  label: string
  amount: number
}

export type ConnectBalanceSnapshot = {
  registered: boolean
  total: number
  pending: number
  available: number
  /** Connect 残高取引から算出した累計受取（振込除く・JPY）。未登録時は null */
  lifetimeReceiveYen: number | null
}

export type MyStoreDashboardStats = {
  lifetimeSalesYen: number
  completedTransactionCount: number
  monthlySales: MonthlySalesPoint[]
  publishedListingCount: number
  draftListingCount: number
  stripe: ConnectBalanceSnapshot | null
  stripeError: string | null
}

type CompletedTxRow = {
  price: number | null
  completed_at: string | null
}

type SkillPublishRow = {
  is_published: boolean | null
}

/** 完了取引の販売価格合計から、手数料差引後の受取額合計（円）を算出 */
export function sumCompletedTransactionReceiveYen(rows: CompletedTxRow[]): number {
  let total = 0
  for (const row of rows) {
    if (typeof row.price === "number" && Number.isFinite(row.price)) {
      total += computeSellerReceiveYen(row.price)
    }
  }
  return total
}

/**
 * アプリ上の完了取引集計と Stripe 入金実績のうち、小さい方を総売上表示に使う。
 * Stripe 側が取得できないときは取引集計のみ。
 */
export function resolveConservativeLifetimeSalesYen(
  transactionLifetimeYen: number,
  stripeLifetimeReceiveYen: number | null | undefined,
): number {
  const fromTransactions = Math.max(0, Math.trunc(transactionLifetimeYen))
  if (stripeLifetimeReceiveYen == null || !Number.isFinite(stripeLifetimeReceiveYen)) {
    return fromTransactions
  }
  const fromStripe = Math.max(0, Math.trunc(stripeLifetimeReceiveYen))
  return Math.min(fromTransactions, fromStripe)
}

export function buildLastSixMonthsSales(rows: CompletedTxRow[]): MonthlySalesPoint[] {
  const now = new Date()
  const buckets: MonthlySalesPoint[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    buckets.push({
      label: `${monthStart.getMonth() + 1}月`,
      amount: 0,
    })
  }

  for (const row of rows) {
    const salePrice =
      typeof row.price === "number" && Number.isFinite(row.price) ? row.price : 0
    if (salePrice <= 0) {
      continue
    }
    const receiveYen = computeSellerReceiveYen(salePrice)
    if (receiveYen <= 0) {
      continue
    }
    const completedAt = row.completed_at ? new Date(row.completed_at) : null
    if (!completedAt || Number.isNaN(completedAt.getTime())) {
      continue
    }
    const monthIndex =
      (completedAt.getFullYear() - now.getFullYear()) * 12 + (completedAt.getMonth() - now.getMonth())
    if (monthIndex > 0 || monthIndex < -5) {
      continue
    }
    const bucketIndex = 5 + monthIndex
    buckets[bucketIndex].amount += receiveYen
  }

  return buckets
}

export function countListingsByPublishState(rows: SkillPublishRow[]): {
  publishedListingCount: number
  draftListingCount: number
} {
  let publishedListingCount = 0
  let draftListingCount = 0
  for (const row of rows) {
    if (row.is_published === true) {
      publishedListingCount += 1
    } else {
      draftListingCount += 1
    }
  }
  return { publishedListingCount, draftListingCount }
}
