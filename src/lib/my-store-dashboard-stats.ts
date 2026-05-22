import { type Currency, DEFAULT_CURRENCY, normalizeCurrency, SUPPORTED_CURRENCIES } from "@/lib/currency"
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

/**
 * 通貨ごとの累計受取額。値は各通貨の最小単位 integer（JPY=yen, USD=cents）。
 * 通貨ごとに分離されているため、決して 1 つの数字に合算してはならない（FX 為替の固定はしない）。
 */
export type LifetimeSalesByCurrency = Record<Currency, number>

export type MyStoreDashboardStats = {
  /**
   * JPY 累計売上（後方互換用）。Stripe Connect の JP 口座は settlement currency が JPY のため、
   * 「Stripe 入金実績との突合」はこの JPY 値を使う。
   * 他通貨の集計は `lifetimeSalesByCurrency` を参照。
   */
  lifetimeSalesYen: number
  /** 通貨ごとの累計売上（最小単位）。JPY 行と USD 行などを混ぜずに表示する用途。 */
  lifetimeSalesByCurrency: LifetimeSalesByCurrency
  completedTransactionCount: number
  monthlySales: MonthlySalesPoint[]
  publishedListingCount: number
  draftListingCount: number
  stripe: ConnectBalanceSnapshot | null
  stripeError: string | null
}

type CompletedTxRow = {
  price: number | null
  /**
   * 行の通貨。未指定（旧データ）は 'JPY' フォールバック扱いとなる。
   * skills.currency / transactions.currency 共に NOT NULL DEFAULT 'JPY' なので
   * 実運用上は null になることはない。
   */
  currency?: string | null
  completed_at: string | null
}

type SkillPublishRow = {
  is_published: boolean | null
}

/**
 * 完了取引の販売価格合計から、手数料差引後の受取額合計を**通貨ごと**に算出。
 * 戻り値は `{ JPY: <yen 合計>, USD: <cents 合計>, ... }` の形式。
 * 0 の通貨もキーとして含まれる（描画側で 0 表示するか判定可能）。
 */
export function sumCompletedTransactionReceiveByCurrency(
  rows: CompletedTxRow[],
): LifetimeSalesByCurrency {
  const totals: LifetimeSalesByCurrency = SUPPORTED_CURRENCIES.reduce((acc, currency) => {
    acc[currency] = 0
    return acc
  }, {} as LifetimeSalesByCurrency)

  for (const row of rows) {
    if (typeof row.price !== "number" || !Number.isFinite(row.price)) {
      continue
    }
    const currency = normalizeCurrency(row.currency)
    totals[currency] += computeSellerReceiveYen(row.price)
  }
  return totals
}

/**
 * JPY 行のみを対象に累計受取額（yen）を算出。
 * Stripe Connect 入金実績（JPY のみ）との比較や、後方互換 UI 用。
 * USD 行など他通貨はゼロとして扱われる（合算しない）。
 */
export function sumCompletedTransactionReceiveYen(rows: CompletedTxRow[]): number {
  return sumCompletedTransactionReceiveByCurrency(rows)[DEFAULT_CURRENCY]
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
    // 通貨ごとの集計を厳格にするため、JPY 以外は月次チャートに含めない
    // （JPY と USD など異通貨を 1 つの棒グラフに混ぜないため）。
    // 他通貨はそれぞれ別途グラフ化するか、別 UI で表示する。
    if (normalizeCurrency(row.currency) !== DEFAULT_CURRENCY) {
      continue
    }
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
