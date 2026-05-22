"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Store } from "lucide-react"
import { LogoutSuccessToast } from "@/components/logout-success-toast"
import { HeroBanner } from "@/components/hero-banner"
import { MyStoreDashboard } from "@/components/my-store-dashboard"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/useI18n"
import { readMypageModePreference } from "@/lib/mypage-mode-preference"
import { buildStorePath } from "@/lib/profile-path"
import {
  buildLastSixMonthsSales,
  sumCompletedTransactionReceiveByCurrency,
  sumCompletedTransactionReceiveYen,
  resolveConservativeLifetimeSalesYen,
  countListingsByPublishState,
  type ConnectBalanceSnapshot,
  type MyStoreDashboardStats,
} from "@/lib/my-store-dashboard-stats"
import type { AppNotice } from "@/lib/notifications"
import { isStripeInstructorSetupComplete } from "@/lib/stripe-setup-status"

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "absolute"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    document.body.removeChild(textarea)
    return copied
  }
}

async function fetchConnectBalanceSnapshot(fallbackErrorMessage: string): Promise<{
  stripe: ConnectBalanceSnapshot | null
  stripeError: string | null
}> {
  try {
    const response = await fetch("/api/stripe/connect-balance", { method: "GET" })
    const payload = (await response.json()) as ConnectBalanceSnapshot & { error?: string }
    if (!response.ok) {
      return { stripe: null, stripeError: payload.error ?? fallbackErrorMessage }
    }
    return {
      stripe: {
        registered: payload.registered,
        total: payload.total ?? 0,
        pending: payload.pending ?? 0,
        available: payload.available ?? 0,
        lifetimeReceiveYen:
          payload.registered && typeof payload.lifetimeReceiveYen === "number"
            ? payload.lifetimeReceiveYen
            : null,
      },
      stripeError: null,
    }
  } catch {
    return { stripe: null, stripeError: fallbackErrorMessage }
  }
}

export default function MyStoreHomeClient() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const tCommon = useTranslations("common")
  const tStore = useTranslations("store")
  const tHeader = useTranslations("header")
  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [savedCustomId, setSavedCustomId] = useState("")
  const [profileLoading, setProfileLoading] = useState(false)
  const [stats, setStats] = useState<MyStoreDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [isStripeSetupComplete, setIsStripeSetupComplete] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) {
        return
      }
      setUserId(data.session?.user?.id ?? null)
      setAuthLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!userId) {
      setSavedCustomId("")
      return
    }
    let cancelled = false
    setProfileLoading(true)
    void (async () => {
      const { data, error } = await supabase.from("profiles").select("custom_id").eq("id", userId).maybeSingle()
      if (cancelled) {
        return
      }
      if (error) {
        setSavedCustomId("")
      } else {
        setSavedCustomId(data?.custom_id?.trim() ?? "")
      }
      setProfileLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const loadDashboardStats = useCallback(async () => {
    if (!userId) {
      setStats(null)
      return
    }
    setStatsLoading(true)
    const [txResult, skillsResult, stripeResult, profileResult] = await Promise.all([
      supabase
        .from("transactions")
        .select("price, currency, completed_at")
        .eq("seller_id", userId)
        .eq("status", "completed"),
      supabase.from("skills").select("is_published").eq("user_id", userId),
      fetchConnectBalanceSnapshot(tStore("stripeBalanceFetchFailed")),
      supabase
        .from("profiles")
        .select("stripe_connect_account_id, is_stripe_registered, stripe_connect_charges_enabled")
        .eq("id", userId)
        .maybeSingle(),
    ])

    const txRows = (txResult.data ?? []) as Array<{
      price: number | null
      currency?: string | null
      completed_at: string | null
    }>
    const transactionLifetimeYen = sumCompletedTransactionReceiveYen(txRows)
    const lifetimeSalesYen = resolveConservativeLifetimeSalesYen(
      transactionLifetimeYen,
      stripeResult.stripe?.registered ? stripeResult.stripe.lifetimeReceiveYen : null,
    )
    const lifetimeSalesByCurrency = sumCompletedTransactionReceiveByCurrency(txRows)

    const listingCounts = countListingsByPublishState(
      (skillsResult.data ?? []) as Array<{ is_published: boolean | null }>,
    )

    setIsStripeSetupComplete(isStripeInstructorSetupComplete(profileResult.data))
    setStats({
      lifetimeSalesYen,
      lifetimeSalesByCurrency,
      completedTransactionCount: txRows.length,
      monthlySales: buildLastSixMonthsSales(txRows),
      ...listingCounts,
      stripe: stripeResult.stripe,
      stripeError: stripeResult.stripeError,
    })
    setStatsLoading(false)
  }, [supabase, userId, tStore])

  useEffect(() => {
    void loadDashboardStats()
  }, [loadDashboardStats])

  const mode = readMypageModePreference()
  const tradesHref =
    mode === "instructor"
      ? "/account/trades?side=seller&panel=active"
      : "/account/trades?side=buyer&panel=active"

  const storePath = userId ? buildStorePath(userId, savedCustomId) : null
  const [storeUrlDisplay, setStoreUrlDisplay] = useState("")

  useEffect(() => {
    if (!storePath || typeof window === "undefined") {
      setStoreUrlDisplay("")
      return
    }
    setStoreUrlDisplay(`${window.location.origin}${storePath}`)
  }, [storePath])

  const handleCopyStoreUrl = useCallback(async () => {
    if (!userId || !storePath) {
      setNotice({ variant: "error", message: tStore("urlFetchFailed") })
      return
    }
    const url = `${window.location.origin}${storePath}`
    const copied = await copyTextToClipboard(url)
    if (!copied) {
      setNotice({ variant: "error", message: tStore("copyFailed") })
      return
    }
    setNotice({ variant: "success", message: tStore("copied") })
  }, [storePath, tStore, userId])

  return (
    <div className="min-w-0 w-full bg-background">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <LogoutSuccessToast />

      <main className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-4 md:px-8 md:pb-8 md:pt-6">
        <div className="mb-6">
          <HeroBanner />
        </div>

        {authLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden />
            {tCommon("loading")}
          </div>
        ) : userId ? (
          <MyStoreDashboard
            userId={userId}
            stats={stats}
            statsLoading={statsLoading}
            isStripeSetupComplete={isStripeSetupComplete}
            storeUrlDisplay={storeUrlDisplay}
            storePath={storePath}
            storeLoading={profileLoading}
            hasCustomId={savedCustomId.trim().length > 0}
            tradesHref={tradesHref}
            onCopyStoreUrl={() => void handleCopyStoreUrl()}
            onNotice={setNotice}
            onListingsChanged={() => void loadDashboardStats()}
          />
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 text-center md:p-8">
            <Store className="mx-auto h-10 w-10 text-primary-readable" aria-hidden />
            <h2 className="mt-4 text-lg font-bold text-foreground">{tStore("notLoggedInTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {tStore("notLoggedInDescription")}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
                <Link href="/login">{tHeader("login")}</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

