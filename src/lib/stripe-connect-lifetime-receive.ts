import "server-only"
import type Stripe from "stripe"

/** 振込（出金）系は累計売上の比較から除外する */
const STRIPE_PAYOUT_BALANCE_TYPES = new Set([
  "payout",
  "payout_cancel",
  "payout_failure",
])

const MAX_BALANCE_TX_PAGES = 50

/**
 * Connect 口座の残高取引 net 合計（振込を除く・JPYのみ）。
 * 返金は net がマイナスになるため差し引かれる。
 */
export async function sumConnectAccountLifetimeReceiveYen(
  stripe: Stripe,
  accountId: string,
): Promise<number> {
  const normalizedAccountId = accountId.trim()
  if (!normalizedAccountId) {
    return 0
  }

  let total = 0
  let startingAfter: string | undefined

  for (let page = 0; page < MAX_BALANCE_TX_PAGES; page += 1) {
    const list = await stripe.balanceTransactions.list(
      {
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
      { stripeAccount: normalizedAccountId },
    )

    for (const balanceTx of list.data) {
      if (balanceTx.currency !== "jpy") {
        continue
      }
      if (STRIPE_PAYOUT_BALANCE_TYPES.has(balanceTx.type)) {
        continue
      }
      if (typeof balanceTx.net === "number" && Number.isFinite(balanceTx.net)) {
        total += balanceTx.net
      }
    }

    if (!list.has_more || list.data.length === 0) {
      break
    }
    startingAfter = list.data[list.data.length - 1]?.id
  }

  return Math.max(0, Math.trunc(total))
}
