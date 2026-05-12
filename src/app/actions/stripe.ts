"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { ensureStripeConnectAccountOwnershipMetadata } from "@/lib/stripe-account-ownership"
import { getAppBaseUrl, getSiteUrl } from "@/lib/site-seo"

type StripeProfileRow = {
  stripe_connect_account_id: string | null
}

const STRIPE_ONBOARDING_DEFAULTS = {
  country: "JP" as const,
  businessType: "individual" as const,
  mcc: "8299", // 教育 > その他
  productDescription: "フィットネスの知識や技術を共有します。",
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(secretKey)
}

const FASTEST_WEEKLY_PAYOUT_DAYS = ["monday", "tuesday", "wednesday", "thursday"] as const

function isRecoverableAutomaticPayoutScheduleError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) {
    return false
  }

  const message = error.message
  return (
    /payout interval "daily" is not available/i.test(message) ||
    /All weekdays is a daily schedule/i.test(message) ||
    /Must provide weekly_anchor or weekly_payout_days/i.test(message)
  )
}

/** Connect 口座を自動振込にし、利用可能な最短スケジュールへそろえる（JP は週次・最大4日） */
async function setConnectedAccountAutomaticPayoutSchedule(
  stripe: Stripe,
  accountId: string,
): Promise<void> {
  const schedules: Stripe.AccountUpdateParams.Settings.Payouts.Schedule[] = [
    { interval: "daily" },
    { interval: "weekly", weekly_payout_days: [...FASTEST_WEEKLY_PAYOUT_DAYS] },
    { interval: "weekly", weekly_anchor: "monday" },
  ]

  let lastError: unknown = null
  for (const schedule of schedules) {
    try {
      await stripe.accounts.update(accountId, {
        settings: {
          payouts: {
            schedule,
          },
        },
      })
      return
    } catch (error) {
      lastError = error
      if (!isRecoverableAutomaticPayoutScheduleError(error)) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Stripe payout schedule update failed")
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
  const baseUrl = getAppBaseUrl()
  const publicSiteUrl = getSiteUrl()

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
        url: publicSiteUrl,
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

    await setConnectedAccountAutomaticPayoutSchedule(stripe, accountId)

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", user.id)
    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  // オンボーディングに進む前に、自動振込スケジュールを利用可能な最短へそろえる。
  // 既存口座にも毎回適用して設定ドリフトを防ぐ。
  await ensureStripeConnectAccountOwnershipMetadata({
    stripe,
    accountId,
    expectedUserId: user.id,
  })
  await stripe.accounts.update(accountId, {
    business_type: STRIPE_ONBOARDING_DEFAULTS.businessType,
    business_profile: {
      mcc: STRIPE_ONBOARDING_DEFAULTS.mcc,
      url: publicSiteUrl,
      product_description: STRIPE_ONBOARDING_DEFAULTS.productDescription,
    },
    individual: {
      address: {
        country: STRIPE_ONBOARDING_DEFAULTS.country,
      },
    },
  })
  await setConnectedAccountAutomaticPayoutSchedule(stripe, accountId)

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
    refresh_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
  })

  return accountLink.url
}

/**
 * オンボーディング済みの講師が Stripe Express ダッシュボードを開くとき用（確認モーダル不要）。
 */
export async function getStripeExpressDashboardUrl() {
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
    throw new Error("Stripe Connect の口座が見つかりません。")
  }

  await ensureStripeConnectAccountOwnershipMetadata({
    stripe,
    accountId,
    expectedUserId: user.id,
  })

  const loginLink = await stripe.accounts.createLoginLink(accountId)
  return loginLink.url
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

  await ensureStripeConnectAccountOwnershipMetadata({
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

  await setConnectedAccountAutomaticPayoutSchedule(stripe, accountId)

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
