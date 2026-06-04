import type Stripe from "stripe"

/**
 * Subscription の請求期間終了 (Unix 秒) を解決する。
 * Stripe Basil (2025-03+) では item 単位の `current_period_end` を優先する。
 */
export function resolveGritvibSubscriptionPeriodEndUnix(
  sub: Stripe.Subscription,
): number | null {
  type PeriodFields = { current_period_end?: number | null; currentPeriodEnd?: number | null }
  const top = sub as Stripe.Subscription & PeriodFields
  if (typeof top.current_period_end === "number") {
    return top.current_period_end
  }
  if (typeof top.currentPeriodEnd === "number") {
    return top.currentPeriodEnd
  }

  let max: number | null = null
  const items = sub.items?.data ?? []
  for (const item of items) {
    const ex = item as Stripe.SubscriptionItem & PeriodFields
    const end = ex.current_period_end ?? ex.currentPeriodEnd
    if (typeof end === "number" && (max === null || end > max)) {
      max = end
    }
  }
  return max
}

export function resolveGritvibSubscriptionPeriodEndIso(
  sub: Stripe.Subscription,
): string | null {
  const unix = resolveGritvibSubscriptionPeriodEndUnix(sub)
  return unix ? new Date(unix * 1000).toISOString() : null
}
