import Stripe from "stripe"
import { assertStripeConnectAccountOwnership } from "@/lib/stripe-account-ownership"
import { requireApiUser } from "@/lib/api-auth"

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

function sumBalanceAmounts(items: Array<{ amount?: number; currency?: string }>): number {
  return items
    .filter((item) => item.currency === "jpy")
    .reduce((sum, item) => sum + (typeof item.amount === "number" ? item.amount : 0), 0)
}

export async function GET() {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }
    const { supabase, user } = auth.context

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .maybeSingle()
    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 500 })
    }

    const accountId = (profile as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id?.trim()
    if (!accountId) {
      return Response.json(
        {
          registered: false,
          total: 0,
          pending: 0,
          available: 0,
          currency: "jpy",
        },
        { status: 200 },
      )
    }

    const stripe = getStripeClient()
    await assertStripeConnectAccountOwnership({
      stripe,
      accountId,
      expectedUserId: user.id,
    })
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId })
    const pending = sumBalanceAmounts(balance.pending)
    const available = sumBalanceAmounts(balance.available)

    return Response.json(
      {
        registered: true,
        total: available + pending,
        pending,
        available,
        currency: "jpy",
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve connect balance"
    return Response.json({ error: message }, { status: 500 })
  }
}
