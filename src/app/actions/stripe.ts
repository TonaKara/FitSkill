"use server"

import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import Stripe from "stripe"
import { ensureStripeConnectAccountOwnershipMetadata } from "@/lib/stripe-account-ownership"
import { getAppBaseUrl, getSiteUrl } from "@/lib/site-seo"

type StripeProfileRow = {
  stripe_connect_account_id: string | null
}

export type StripeOnboardingUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export type StripeExpressDashboardUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export type StripeFinalizeStatusResult =
  | { ok: true; finalized: boolean }
  | { ok: false; finalized: false; error: string }

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

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function isRecoverableAutomaticPayoutScheduleError(error: unknown): boolean {
  const message = readErrorMessage(error)
  return (
    /payout interval "daily" is not available/i.test(message) ||
    /All weekdays is a daily schedule/i.test(message) ||
    /Must provide weekly_anchor or weekly_payout_days/i.test(message)
  )
}

function buildAutomaticPayoutSchedules(
  country: string | null | undefined,
): Stripe.AccountUpdateParams.Settings.Payouts.Schedule[] {
  const schedules: Stripe.AccountUpdateParams.Settings.Payouts.Schedule[] = [
    { interval: "weekly", weekly_payout_days: [...FASTEST_WEEKLY_PAYOUT_DAYS] },
    { interval: "weekly", weekly_anchor: "monday" },
  ]

  if (country?.toUpperCase() !== "JP") {
    schedules.unshift({ interval: "daily" })
  }

  return schedules
}

/** Connect 口座を自動振込にし、利用可能な最短スケジュールへそろえる（JP は週次・最大4日） */
async function setConnectedAccountAutomaticPayoutSchedule(
  stripe: Stripe,
  accountId: string,
): Promise<void> {
  let country: string | null | undefined
  try {
    const account = await stripe.accounts.retrieve(accountId)
    country = account.country
  } catch {
    country = STRIPE_ONBOARDING_DEFAULTS.country
  }

  const schedules = buildAutomaticPayoutSchedules(country)
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

async function trySetConnectedAccountAutomaticPayoutSchedule(
  stripe: Stripe,
  accountId: string,
): Promise<void> {
  try {
    await setConnectedAccountAutomaticPayoutSchedule(stripe, accountId)
  } catch (error) {
    console.error("[stripe] automatic payout schedule update failed", {
      accountId,
      message: readErrorMessage(error),
    })
  }
}

async function clearStoredConnectAccountId(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_connect_account_id: null })
    .eq("id", userId)
  if (error) {
    throw new Error(error.message)
  }
}

async function createConnectAccountForUser(
  stripe: Stripe,
  userId: string,
  publicSiteUrl: string,
): Promise<string> {
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
    metadata: { user_id: userId },
  })
  return account.id
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

export async function getStripeOnboardingUrl(consented: boolean): Promise<StripeOnboardingUrlResult> {
  if (consented !== true) {
    return { ok: false, error: "オンボーディング内容への同意が必要です。" }
  }

  try {
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
      return { ok: false, error: profileError.message }
    }

    let accountId = profile?.stripe_connect_account_id?.trim() || ""
    if (accountId) {
      try {
        await ensureStripeConnectAccountOwnershipMetadata({
          stripe,
          accountId,
          expectedUserId: user.id,
        })
        await stripe.accounts.retrieve(accountId)
      } catch (error) {
        console.error("[stripe] stored connect account is invalid; creating a new account", {
          accountId,
          userId: user.id,
          message: readErrorMessage(error),
        })
        await clearStoredConnectAccountId(supabase, user.id)
        accountId = ""
      }
    }

    if (!accountId) {
      accountId = await createConnectAccountForUser(stripe, user.id, publicSiteUrl)

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id)
      if (updateError) {
        return { ok: false, error: updateError.message }
      }
    }

    // オンボーディングに進む前に、自動振込スケジュールを利用可能な最短へそろえる。
    // 既存口座にも毎回適用して設定ドリフトを防ぐ。
    try {
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
    } catch (error) {
      console.error("[stripe] connect business profile update failed", {
        accountId,
        userId: user.id,
        message: readErrorMessage(error),
      })
    }
    await trySetConnectedAccountAutomaticPayoutSchedule(stripe, accountId)

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      return_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
      refresh_url: `${baseUrl}/mypage?tab=payout&mode=instructor&stripe=return`,
    })

    return { ok: true, url: accountLink.url }
  } catch (error) {
    console.error("[stripe] onboarding url issue failed", {
      message: readErrorMessage(error),
    })
    return { ok: false, error: readErrorMessage(error) || "Stripe onboarding failed" }
  }
}

/**
 * オンボーディング済みの講師が Stripe Express ダッシュボードを開くとき用（確認モーダル不要）。
 */
export async function getStripeExpressDashboardUrl(): Promise<StripeExpressDashboardUrlResult> {
  try {
    const { supabase, user } = await getAuthedSupabase()
    const stripe = getStripeClient()

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single<StripeProfileRow>()
    if (profileError) {
      return { ok: false, error: profileError.message }
    }

    const accountId = profile?.stripe_connect_account_id?.trim() || ""
    if (!accountId) {
      return { ok: false, error: "Stripe Connect の口座が見つかりません。" }
    }

    await ensureStripeConnectAccountOwnershipMetadata({
      stripe,
      accountId,
      expectedUserId: user.id,
    })

    const loginLink = await stripe.accounts.createLoginLink(accountId)
    return { ok: true, url: loginLink.url }
  } catch (error) {
    console.error("[stripe] express dashboard url issue failed", {
      message: readErrorMessage(error),
    })
    return { ok: false, error: readErrorMessage(error) || "Stripe dashboard failed" }
  }
}

export async function checkAndFinalizeStripeStatus(): Promise<StripeFinalizeStatusResult> {
  try {
    const { supabase, user } = await getAuthedSupabase()
    const stripe = getStripeClient()

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", user.id)
      .single<StripeProfileRow>()
    if (profileError) {
      return { ok: false, finalized: false, error: profileError.message }
    }

    const accountId = profile?.stripe_connect_account_id?.trim() || ""
    if (!accountId) {
      return { ok: true, finalized: false }
    }

    try {
      await ensureStripeConnectAccountOwnershipMetadata({
        stripe,
        accountId,
        expectedUserId: user.id,
      })
    } catch (error) {
      console.error("[stripe] finalize skipped due to connect account validation failure", {
        accountId,
        userId: user.id,
        message: readErrorMessage(error),
      })
      return { ok: true, finalized: false }
    }

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
      return { ok: true, finalized: false }
    }

    await trySetConnectedAccountAutomaticPayoutSchedule(stripe, accountId)

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_stripe_registered: true,
        stripe_connect_charges_enabled: true,
        stripe_connect_details_submitted: true,
      })
      .eq("id", user.id)
    if (updateError) {
      return { ok: false, finalized: false, error: updateError.message }
    }

    return { ok: true, finalized: true }
  } catch (error) {
    console.error("[stripe] finalize status failed", {
      message: readErrorMessage(error),
    })
    return { ok: false, finalized: false, error: readErrorMessage(error) || "Stripe finalize failed" }
  }
}
