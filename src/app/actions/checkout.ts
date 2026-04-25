"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Stripe from "stripe"

type SkillRow = {
  id: string
  title: string
  user_id: string
  price: number
}

type TransactionInsertRow = {
  id: string
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

async function getAuthedSupabase() {
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
    throw new Error("Unauthorized")
  }

  return { supabase, user }
}

export async function createCheckoutSession(skillId: string) {
  if (!skillId?.trim()) {
    throw new Error("skillId is required")
  }

  const { supabase, user } = await getAuthedSupabase()
  const stripe = getStripeClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const { data: skill, error: skillError } = await supabase
    .from("skills")
    .select("id, title, user_id, price")
    .eq("id", skillId)
    .single<SkillRow>()

  if (skillError || !skill) {
    throw new Error(skillError?.message ?? "Skill not found")
  }

  if (skill.user_id === user.id) {
    throw new Error("You cannot purchase your own skill")
  }

  const amount = Math.max(0, Math.round(Number(skill.price)))
  if (amount < 1) {
    throw new Error("Invalid skill price")
  }

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .insert({
      skill_id: skill.id,
      buyer_id: user.id,
      seller_id: skill.user_id,
      price: amount,
      status: "pending",
    })
    .select("id")
    .single<TransactionInsertRow>()

  if (txError || !tx) {
    throw new Error(txError?.message ?? "Failed to create transaction")
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: amount,
          product_data: {
            name: skill.title,
          },
        },
      },
    ],
    success_url: `${appUrl}/chat/${tx.id}?checkout=success`,
    cancel_url: `${appUrl}/skills/${skill.id}?checkout=cancel`,
    metadata: {
      transaction_id: tx.id,
      skill_id: skill.id,
      buyer_id: user.id,
      seller_id: skill.user_id,
    },
  })

  if (!session.url) {
    throw new Error("Failed to create checkout session URL")
  }

  return {
    url: session.url,
    transactionId: tx.id,
  }
}
