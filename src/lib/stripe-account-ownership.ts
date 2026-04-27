import "server-only"
import Stripe from "stripe"

/**
 * Stripe Connectアカウントが期待するユーザー所有かを検証する。
 * metadata.user_id を信頼境界として扱い、一致しない場合は拒否する。
 */
export async function assertStripeConnectAccountOwnership(params: {
  stripe: Stripe
  accountId: string
  expectedUserId: string
}): Promise<void> {
  const { stripe, accountId, expectedUserId } = params
  const normalizedAccountId = accountId.trim()
  const normalizedExpectedUserId = expectedUserId.trim()

  if (!normalizedAccountId || !normalizedExpectedUserId) {
    throw new Error("Stripe account ownership validation requires accountId and expectedUserId.")
  }

  const account = await stripe.accounts.retrieve(normalizedAccountId)
  const ownerUserId = account.metadata?.user_id?.trim() ?? ""

  if (!ownerUserId || ownerUserId !== normalizedExpectedUserId) {
    throw new Error("Unauthorized Stripe account access.")
  }
}
