import "server-only"
import Stripe from "stripe"

function resolveStripeConnectOwnerUserId(metadata: Stripe.Metadata | null | undefined): string {
  const userId = metadata?.user_id?.trim() ?? ""
  if (userId) {
    return userId
  }
  return metadata?.supabase_user_id?.trim() ?? ""
}

/**
 * Stripe Connectアカウントが期待するユーザー所有かを検証する。
 * metadata.user_id（現行）と metadata.supabase_user_id（旧 Edge Function 作成分）を許容する。
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
  const ownerUserId = resolveStripeConnectOwnerUserId(account.metadata)

  if (!ownerUserId || ownerUserId !== normalizedExpectedUserId) {
    throw new Error("Unauthorized Stripe account access.")
  }
}

export async function ensureStripeConnectAccountOwnershipMetadata(params: {
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
  const ownerUserId = resolveStripeConnectOwnerUserId(account.metadata)

  if (!ownerUserId) {
    await stripe.accounts.update(normalizedAccountId, {
      metadata: {
        ...(account.metadata ?? {}),
        user_id: normalizedExpectedUserId,
      },
    })
    return
  }

  if (ownerUserId !== normalizedExpectedUserId) {
    throw new Error("Unauthorized Stripe account access.")
  }

  if (!account.metadata?.user_id?.trim()) {
    await stripe.accounts.update(normalizedAccountId, {
      metadata: {
        ...(account.metadata ?? {}),
        user_id: normalizedExpectedUserId,
      },
    })
  }
}
