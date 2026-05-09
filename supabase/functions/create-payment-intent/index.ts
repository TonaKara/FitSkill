import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import Stripe from "npm:stripe@17.5.0"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/** アプリの `SELLER_FEE_RATE`（src/lib/seller-fee-preview.ts）と一致させること */
const FEE_RATE = 0.15

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!stripeSecret || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "サーバー設定が不足しています。" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authHeader = req.headers.get("Authorization") ?? ""
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser()
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "認証が必要です。" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json().catch(() => ({}))) as { transactionId?: string }
    const transactionId = body.transactionId?.trim()
    if (!transactionId) {
      return new Response(JSON.stringify({ error: "transactionId が必要です。" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { data: tx, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, buyer_id, seller_id, skill_id, price, status, stripe_payment_intent_id")
      .eq("id", transactionId)
      .maybeSingle()

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: "取引が見つかりません。" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const row = tx as {
      buyer_id: string
      seller_id: string
      price: number
      status: string
      stripe_payment_intent_id: string | null
    }

    if (row.buyer_id !== user.id) {
      return new Response(JSON.stringify({ error: "この取引の購入者のみ決済できます。" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (row.status !== "awaiting_payment") {
      return new Response(JSON.stringify({ error: "この取引は決済待ちではありません。" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (row.stripe_payment_intent_id) {
      const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })
      const existing = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id)
      if (existing.client_secret) {
        return new Response(
          JSON.stringify({
            clientSecret: existing.client_secret,
            paymentIntentId: existing.id,
            publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        )
      }
    }

    const { data: sellerProfile, error: spErr } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", row.seller_id)
      .maybeSingle()

    if (spErr || !sellerProfile) {
      return new Response(JSON.stringify({ error: "講師のプロフィールを取得できませんでした。" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const seller = sellerProfile as {
      stripe_connect_account_id: string | null
      stripe_connect_charges_enabled: boolean | null
    }

    if (!seller.stripe_connect_account_id) {
      return new Response(
        JSON.stringify({ error: "講師が振込先（Stripe Connect）の登録を完了していません。しばらくしてからお試しください。" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })
    const acct = await stripe.accounts.retrieve(seller.stripe_connect_account_id)
    if (!acct.charges_enabled) {
      return new Response(
        JSON.stringify({ error: "講師の決済受付設定が有効になっていません。" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const amount = Math.max(0, Math.round(Number(row.price)))
    if (amount < 1) {
      return new Response(JSON.stringify({ error: "取引金額が不正です。" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const applicationFeeAmount = Math.floor(amount * FEE_RATE)

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "jpy",
      automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFeeAmount,
      transfer_data: { destination: seller.stripe_connect_account_id },
      metadata: {
        transactionId: transactionId,
        buyerId: user.id,
        transaction_id: transactionId,
        buyer_id: user.id,
        skill_id: String((tx as { skill_id?: string }).skill_id ?? ""),
      },
    })

    const { error: upErr } = await supabaseAdmin
      .from("transactions")
      .update({ stripe_payment_intent_id: pi.id })
      .eq("id", transactionId)
      .eq("buyer_id", user.id)

    if (upErr) {
      await stripe.paymentIntents.cancel(pi.id).catch(() => undefined)
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
        publishableKey: Deno.env.get("STRIPE_PUBLISHABLE_KEY") ?? "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
