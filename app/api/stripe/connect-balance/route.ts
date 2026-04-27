import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Stripe from "stripe"

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

async function getAuthedUserAndSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null }
  }
  return { supabase, user }
}

function sumBalanceAmounts(items: Array<{ amount?: number; currency?: string }>): number {
  return items
    .filter((item) => item.currency === "jpy")
    .reduce((sum, item) => sum + (typeof item.amount === "number" ? item.amount : 0), 0)
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthedUserAndSupabase()
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

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
