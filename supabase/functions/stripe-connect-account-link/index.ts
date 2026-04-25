import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import Stripe from "npm:stripe@17.5.0"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

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
      return new Response(JSON.stringify({ error: "サーバー設定（Stripe / Supabase）が不足しています。" }), {
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

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, stripe_connect_account_id")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let accountId = (profile as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? null

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "JP",
        email: user.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { supabase_user_id: user.id },
      })
      accountId = account.id
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id)
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    const body = (await req.json().catch(() => ({}))) as { mode?: string }
    const mode = body.mode === "dashboard" ? "dashboard" : "onboarding"

    if (mode === "dashboard") {
      const loginLink = await stripe.accounts.createLoginLink(accountId)
      const balance = await stripe.balance.retrieve({ stripeAccount: accountId })
      const availableJpy = (balance.available ?? [])
        .filter((entry) => entry.currency === "jpy")
        .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
      const pendingJpy = (balance.pending ?? [])
        .filter((entry) => entry.currency === "jpy")
        .reduce((sum, entry) => sum + Math.max(0, entry.amount), 0)
      const nextPayoutJpy = availableJpy

      return new Response(
        JSON.stringify({
          mode,
          url: loginLink.url,
          accountId,
          availableJpy,
          pendingJpy,
          salesBalanceJpy: availableJpy + pendingJpy,
          nextPayoutJpy,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "http://localhost:3000"
    const refreshUrl = `${appUrl}/mypage?tab=payout&stripe_refresh=1`
    const returnUrl = `${appUrl}/mypage?tab=payout&stripe_return=1`

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    })

    return new Response(JSON.stringify({ mode, url: accountLink.url, accountId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
