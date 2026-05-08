"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { assertStripeConnectAccountOwnership } from "@/lib/stripe-account-ownership"

type StripeProfileRow = {
  stripe_connect_account_id: string | null
}

const STRIPE_ONBOARDING_DEFAULTS = {
  country: "JP" as const,
  businessType: "individual" as const,
  mcc: "8299", // 教育 > その他
  websiteUrl: "https://gritvib.com",
  productDescription: "フィットネスの知識や技術を共有します。",
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

async function disableAutomaticPayouts(
  stripe: Stripe,
  accountId: string,
): Promise<void> {
  await stripe.accounts.update(accountId, {
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  })
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

export async function getStripeOnboardingUrl(consented: boolean) {
  if (consented !== true) {
    throw new Error("オンボーディング内容への同意が必要です。")
  }

  const { supabase, user } = await getAuthedSupabase()
  const stripe = getStripeClient()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single<StripeProfileRow>()
  if (profileError) {
    throw new Error(profileError.message)
  }

  let accountId = profile?.stripe_connect_account_id?.trim() || ""
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: STRIPE_ONBOARDING_DEFAULTS.country,
      business_type: STRIPE_ONBOARDING_DEFAULTS.businessType,
      business_profile: {
        mcc: STRIPE_ONBOARDING_DEFAULTS.mcc,
        url: STRIPE_ONBOARDING_DEFAULTS.websiteUrl,
        product_description: STRIPE_ONBOARDING_DEFAULTS.productDescription,
      },
      individual: {
        address: {
          country: STRIPE_ONBOARDING_DEFAULTS.country,
        },
      },
      metadata: { user_id: user.id },
    })
    accountId = account.id

    await disableAutomaticPayouts(stripe, accountId)

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", user.id)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  // オンボーディングに進む時点で、自動振込を常に無効化しておく。
  // 既存口座にも毎回適用することで、設定ドリフトを防ぐ。
  await assertStripeConnectAccountOwnership({
    stripe,
    accountId,
    expectedUserId: user.id,
  })
  await stripe.accounts.update(accountId, {
    business_type: STRIPE_ONBOARDING_DEFAULTS.businessType,
    business_profile: {
      mcc: STRIPE_ONBOARDING_DEFAULTS.mcc,
      url: STRIPE_ONBOARDING_DEFAULTS.websiteUrl,
      product_description: STRIPE_ONBOARDING_DEFAULTS.productDescription,
    },
    individual: {
      address: {
        country: STRIPE_ONBOARDING_DEFAULTS.country,
      },
    },
  })
  await disableAutomaticPayouts(stripe, accountId)

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
    refresh_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
  })

  console.log("[Stripe onboarding URL]", accountLink.url)
  return accountLink.url
}

export async function checkAndFinalizeStripeStatus() {
  const { supabase, user } = await getAuthedSupabase()
  const stripe = getStripeClient()

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .single<StripeProfileRow>()
  if (profileError) {
    throw new Error(profileError.message)
  }

  const accountId = profile?.stripe_connect_account_id?.trim() || ""
  if (!accountId) {
    return { finalized: false }
  }

  await assertStripeConnectAccountOwnership({
    stripe,
    accountId,
    expectedUserId: user.id,
  })

  /** オンボーディング直後は Stripe API 上で charges_enabled の反映が数秒遅れることがある */
  const CHARGES_POLL_ATTEMPTS = 5
  const CHARGES_POLL_INTERVAL_MS = 1200

  let account: Stripe.Account | null = null
  for (let attempt = 0; attempt < CHARGES_POLL_ATTEMPTS; attempt++) {
    account = await stripe.accounts.retrieve(accountId)
    if (account.charges_enabled && account.details_submitted) {
      break
    }
    if (attempt < CHARGES_POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, CHARGES_POLL_INTERVAL_MS))
    }
  }

  if (!account?.charges_enabled || !account.details_submitted) {
    await supabase
      .from("profiles")
      .update({
        stripe_connect_charges_enabled: account?.charges_enabled ?? false,
        stripe_connect_details_submitted: account?.details_submitted ?? false,
      })
      .eq("id", user.id)
    return { finalized: false }
  }

  await disableAutomaticPayouts(stripe, accountId)

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      is_stripe_registered: true,
      stripe_connect_charges_enabled: true,
      stripe_connect_details_submitted: true,
    })
    .eq("id", user.id)
  if (updateError) {
    throw new Error(updateError.message)
  }

  return { finalized: true }
}
