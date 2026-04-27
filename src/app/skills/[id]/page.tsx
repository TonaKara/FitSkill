"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ChevronRight, Loader2, MapPin, MessageCircle, Monitor, Star, Users } from "lucide-react"
import { ReportModal } from "@/components/report/ReportModal"
import { StripePaymentSheet } from "@/components/stripe-payment-sheet"
import { TradeFinalConfirmStep } from "@/components/TradeFinalConfirmStep"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"
import { getIsAdminFromProfile } from "@/lib/admin"
import { formatErrorMessageOnly } from "@/lib/notifications"
import type { AppNotice } from "@/lib/notifications"
import { createCheckoutSession, finalizeCheckoutSessionAfterSuccess } from "@/actions/checkout"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { countActiveTransactionsForSkill, createSkillPurchaseTransaction } from "@/lib/transactions"
import { createGeneralNotification } from "@/lib/transaction-notifications"
import {
  fetchConsultationSettings,
  fetchMyConsultationAnswer,
  toConsultationSkillId,
  type ConsultationAnswerRow,
  type ConsultationSettingsRow,
} from "@/lib/consultation"
import { cn } from "@/lib/utils"

type ProfileEmbed = {
  display_name: string | null
  avatar_url: string | null
  rating_avg: number | null
  review_count: number | null
}

type SkillDetailRow = {
  id: string
  user_id: string
  title: string
  description: string
  target_audience: string
  category: string
  price: number
  duration_minutes: number
  max_capacity: number
  format: "online" | "onsite"
  location_prefecture: string | null
  thumbnail_url: string | null
  is_published: boolean | null
  profiles: ProfileEmbed | ProfileEmbed[] | null
}

/** `transactions` の1行（buyer かつ active の取引表示用） */
type ActiveTransactionRow = {
  id: string | number
  skill_id: string
  buyer_id: string
  seller_id: string
  status: string
  price: number
  created_at?: string
  stripe_payment_intent_id?: string | null
}

const CHAT_TRANSITION_STATUSES = [
  "pending",
  "in_progress",
  "active",
  "approval_pending",
  "disputed",
] as const
const TERMINAL_REPURCHASE_STATUSES = ["completed", "canceled", "refunded"] as const
const CHECKABLE_TRANSACTION_STATUSES = [
  "awaiting_payment",
  ...CHAT_TRANSITION_STATUSES,
  ...TERMINAL_REPURCHASE_STATUSES,
] as const
const PRIORITIZED_TRANSACTION_STATUSES = ["awaiting_payment", ...CHAT_TRANSITION_STATUSES] as const

function normalizeProfile(profiles: SkillDetailRow["profiles"]): ProfileEmbed | null {
  if (!profiles) {
    return null
  }
  return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
}

function formatLessonFormat(format: SkillDetailRow["format"]): string {
  if (format === "online") {
    return "オンライン"
  }
  if (format === "onsite") {
    return "対面"
  }
  return String(format)
}

function formatLocation(row: SkillDetailRow): string {
  if (row.format === "online") {
    return "オンライン"
  }
  const p = row.location_prefecture?.trim()
  return p && p.length > 0 ? p : "都道府県未設定"
}

export default function SkillDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const skillId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : ""

  const [loading, setLoading] = useState(true)
  const [skill, setSkill] = useState<SkillDetailRow | null>(null)
  const [enrolledCount, setEnrolledCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [purchasePending, setPurchasePending] = useState(false)
  const [purchaseProgressLabel, setPurchaseProgressLabel] = useState("読み込み中...")
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [purchaseConfirmOpen, setPurchaseConfirmOpen] = useState(false)
  const [purchaseConfirmKey, setPurchaseConfirmKey] = useState(0)
  const [stripePaymentOpen, setStripePaymentOpen] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState("")
  const [stripePublishableKey, setStripePublishableKey] = useState("")
  const [legalPortalReady, setLegalPortalReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [, setActiveTransaction] = useState<ActiveTransactionRow | null>(null)
  const [transactionRows, setTransactionRows] = useState<ActiveTransactionRow[]>([])
  const [transactionStatus, setTransactionStatus] = useState<string | null>(null)
  const [transactionStatusLoading, setTransactionStatusLoading] = useState(true)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [consultationSettings, setConsultationSettings] = useState<ConsultationSettingsRow | null>(null)
  const [consultationAnswer, setConsultationAnswer] = useState<ConsultationAnswerRow | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consultationFormOpen, setConsultationFormOpen] = useState(false)
  const [consultationForm, setConsultationForm] = useState({
    a1: "",
    a2: "",
    a3: "",
    free: "",
  })
  const checkoutFinalizeStateRef = useRef<{
    sessionId: string | null
    attempts: number
    stopped: boolean
  }>({
    sessionId: null,
    attempts: 0,
    stopped: false,
  })

  useEffect(() => {
    setLegalPortalReady(true)
  }, [])

  const fetchLatestRelevantTransaction = useCallback(async (): Promise<ActiveTransactionRow[] | undefined> => {
    if (!skillId || !userId) {
      return []
    }

    const { data: prioritizedData, error: prioritizedError } = await supabase
      .from("transactions")
      .select("*")
      .eq("skill_id", skillId)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in("status", [...PRIORITIZED_TRANSACTION_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
    if (prioritizedError) {
      console.error("[skills:fetchLatestRelevantTransaction] prioritized query error", {
        skillId,
        userId,
        statuses: PRIORITIZED_TRANSACTION_STATUSES,
        message: prioritizedError.message,
      })
      return undefined
    }
    const prioritizedRows = (prioritizedData ?? []) as ActiveTransactionRow[]
    if (prioritizedRows.length > 0) {
      return prioritizedRows
    }

    const { data: terminalData, error: terminalError } = await supabase
      .from("transactions")
      .select("*")
      .eq("skill_id", skillId)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .in("status", [...TERMINAL_REPURCHASE_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
    if (terminalError) {
      console.error("[skills:fetchLatestRelevantTransaction] terminal query error", {
        skillId,
        userId,
        statuses: TERMINAL_REPURCHASE_STATUSES,
        message: terminalError.message,
      })
      return undefined
    }
    return (terminalData ?? []) as ActiveTransactionRow[]
  }, [skillId, supabase, userId])

  /** DB と一致させる: このスキル・自分に紐づく取引を最新1件 */
  const fetchActiveTransaction = useCallback(async (): Promise<ActiveTransactionRow[] | undefined> => {
    const rows = await fetchLatestRelevantTransaction()
    if (rows === undefined) {
      // 一時的な取得失敗時は既存 state を維持し、ボタンの誤切り替えを防ぐ
      return undefined
    }
    const firstStatus = rows.length > 0 ? rows[0]?.status : null
    console.log("[skills:fetchActiveTransaction] rows", {
      skillId,
      userId,
      statuses: CHECKABLE_TRANSACTION_STATUSES,
      rowsLength: rows.length,
      firstStatus,
      rows,
    })
    return rows
  }, [fetchLatestRelevantTransaction, skillId, userId])

  const startStripePaymentForTransaction = useCallback(
    async (targetSkillId: string): Promise<boolean> => {
      console.log("[skills:startStripePaymentForTransaction] start", { skillId: targetSkillId })
      setPurchaseProgressLabel("決済を準備中...")
      try {
        const result = await createCheckoutSession(targetSkillId)
        if (!result.ok) {
          setPurchaseError(
            formatErrorMessageOnly({ message: result.error }, isAdmin, {
              unknownErrorMessage: "決済の準備に失敗しました。",
            }),
          )
          console.error("[skills:startStripePaymentForTransaction] createCheckoutSession failed", {
            skillId: targetSkillId,
            error: result.error,
          })
          return false
        }
        const { url } = result
        console.log("[skills:startStripePaymentForTransaction] createCheckoutSession result", {
          skillId: targetSkillId,
          hasUrl: Boolean(url),
          url,
        })
        if (!url) {
          setPurchaseError("決済ページを作成できませんでした。")
          return false
        }
        window.location.href = url
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : "決済の準備に失敗しました。"
        setPurchaseError(
          formatErrorMessageOnly({ message: msg }, isAdmin, {
            unknownErrorMessage: "決済の準備に失敗しました。",
          }),
        )
        console.error("[skills:startStripePaymentForTransaction] createCheckoutSession error", {
          skillId: targetSkillId,
          message: msg,
        })
        return false
      }
    },
    [isAdmin],
  )

  const paymentRedirectStatus = searchParams.get("redirect_status")
  const paymentIntentParam = searchParams.get("payment_intent")
  const checkoutStatus = searchParams.get("checkout")
  const checkoutSessionId = searchParams.get("session_id")
  const checkoutAutoRedirectStorageKey = checkoutSessionId
    ? `skills_checkout_redirect_handled:${checkoutSessionId}`
    : null
  const checkoutReturnKey = [
    paymentRedirectStatus ?? "",
    paymentIntentParam ?? "",
    checkoutStatus ?? "",
    checkoutSessionId ?? "",
  ].join("|")

  useEffect(() => {
    if (!skillId || !userId || loading) {
      return
    }
    const paidByPaymentIntent = paymentRedirectStatus === "succeeded" && Boolean(paymentIntentParam)
    const paidByCheckout = checkoutStatus === "success"
    if (!paidByPaymentIntent && !paidByCheckout) {
      return
    }
    if (checkoutAutoRedirectStorageKey && typeof window !== "undefined") {
      const alreadyHandled = window.sessionStorage.getItem(checkoutAutoRedirectStorageKey) === "1"
      if (alreadyHandled) {
        router.replace(`/skills/${skillId}`)
        return
      }
    }
    let cancelled = false
    void (async () => {
      if (!paidByCheckout || !checkoutSessionId) {
        checkoutFinalizeStateRef.current = { sessionId: null, attempts: 0, stopped: false }
      } else if (checkoutFinalizeStateRef.current.sessionId !== checkoutSessionId) {
        checkoutFinalizeStateRef.current = { sessionId: checkoutSessionId, attempts: 0, stopped: false }
      }

      for (let i = 0; i < 40; i += 1) {
        if (cancelled) {
          return
        }
        if (paidByCheckout && checkoutSessionId) {
          const finalizeState = checkoutFinalizeStateRef.current
          if (
            !finalizeState.stopped &&
            finalizeState.sessionId === checkoutSessionId &&
            finalizeState.attempts < 5
          ) {
            finalizeState.attempts += 1
            const finalized = await finalizeCheckoutSessionAfterSuccess(checkoutSessionId)
            if (cancelled) {
              return
            }
            if (finalized.ok) {
              finalizeState.stopped = true
              if (CHAT_TRANSITION_STATUSES.includes(finalized.status as (typeof CHAT_TRANSITION_STATUSES)[number])) {
                if (checkoutAutoRedirectStorageKey && typeof window !== "undefined") {
                  window.sessionStorage.setItem(checkoutAutoRedirectStorageKey, "1")
                }
                router.replace(`/skills/${skillId}`)
                router.push(`/chat/${finalized.transactionId}`)
                return
              }
            } else {
              const isMissingColumn = finalized.error.includes("stripe_payment_intent_id")
              if (isMissingColumn || finalizeState.attempts >= 5) {
                finalizeState.stopped = true
                if (isMissingColumn) {
                  setPurchaseError("決済情報の反映に失敗しました。時間をおいて再度お試しください。")
                }
              }
              console.warn("[skills:checkout-finalize] pending", {
                checkoutSessionId,
                message: finalized.error,
                attempt: finalizeState.attempts,
                stopped: finalizeState.stopped,
              })
            }
          }
        }
        const rows = await fetchActiveTransaction()
        const latest = rows?.[0]
        const st = latest?.status
        if (
          latest?.id != null &&
          st &&
          CHAT_TRANSITION_STATUSES.includes(st as (typeof CHAT_TRANSITION_STATUSES)[number])
        ) {
          const tid = String(latest.id)
          if (checkoutAutoRedirectStorageKey && typeof window !== "undefined") {
            window.sessionStorage.setItem(checkoutAutoRedirectStorageKey, "1")
          }
          router.replace(`/skills/${skillId}`)
          router.push(`/chat/${tid}`)
          return
        }
        await new Promise((r) => setTimeout(r, 300))
      }
      if (!cancelled) {
        setPurchaseError("決済後の取引反映に時間がかかっています。マイページからチャットを開いてください。")
        router.replace(`/skills/${skillId}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    skillId,
    userId,
    loading,
    checkoutReturnKey,
    checkoutAutoRedirectStorageKey,
    router,
    fetchActiveTransaction,
  ])

  const load = useCallback(async () => {
    if (!skillId) {
      setSkill(null)
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id ?? null

    const [skillResult, activePurchaseCount, consultationSetting] = await Promise.all([
      supabase
        .from("skills")
        .select(
          "id, user_id, title, description, target_audience, category, price, duration_minutes, max_capacity, format, location_prefecture, thumbnail_url, is_published, profiles ( display_name, avatar_url, rating_avg, review_count )",
        )
        .eq("id", skillId)
        .maybeSingle(),
      countActiveTransactionsForSkill(supabase, skillId),
      fetchConsultationSettings(supabase, skillId),
    ])

    setUserId(uid)
    if (uid) {
      setIsAdmin(await getIsAdminFromProfile(supabase, uid))
    } else {
      setIsAdmin(false)
    }

    if (skillResult.error || !skillResult.data) {
      setSkill(null)
    } else {
      const row = skillResult.data as SkillDetailRow
      const isPrivate = row.is_published === false
      if (isPrivate && row.user_id !== uid) {
        setSkill(null)
      } else {
        setSkill(row)
      }
    }

    setEnrolledCount(Number(activePurchaseCount))
    setConsultationSettings(consultationSetting)
    if (uid && consultationSetting?.is_enabled) {
      const myAnswer = await fetchMyConsultationAnswer(supabase, skillId, uid)
      setConsultationAnswer(myAnswer)
    } else {
      setConsultationAnswer(null)
    }
    setLoading(false)
  }, [skillId, supabase])

  useEffect(() => {
    // 非同期ロード完了時のみ state が更新されるため、この呼び出しを許可する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  /** ページ表示時: DB の進行中取引とボタン表示を一致させる */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!skillId || !userId) {
        if (!cancelled) {
          setTransactionRows([])
          setTransactionStatus(null)
          setActiveTransaction(null)
          setTransactionStatusLoading(false)
        }
        return
      }
      if (!cancelled) {
        setTransactionStatusLoading(true)
      }
      const rows = await fetchActiveTransaction()
      if (cancelled) return
      if (rows === undefined) {
        // 取得失敗時は既存 state を維持して、ボタンの誤切り替えを防ぐ
        setTransactionStatusLoading(false)
        return
      }
      const latest = rows[0] ?? null
      const status = latest?.status ?? null
      setTransactionRows(rows)
      setTransactionStatus(status)
      if (
        latest?.id != null &&
        status &&
        CHAT_TRANSITION_STATUSES.includes(status as (typeof CHAT_TRANSITION_STATUSES)[number])
      ) {
        setActiveTransaction(latest)
      } else {
        setActiveTransaction(null)
      }
      setTransactionStatusLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [skillId, userId, fetchActiveTransaction])

  /** 参加人数と active 取引を短い間隔で再取得 */
  useEffect(() => {
    if (!skillId || loading || !skill) {
      return
    }
    const tick = async () => {
      const n = await countActiveTransactionsForSkill(supabase, skillId)
      setEnrolledCount(Number(n))
      if (userId) {
        const rows = await fetchActiveTransaction()
        if (rows !== undefined) {
          const latest = rows[0] ?? null
          const status = latest?.status ?? null
          setTransactionRows(rows)
          setTransactionStatus(status)
          if (
            latest?.id != null &&
            status &&
            CHAT_TRANSITION_STATUSES.includes(status as (typeof CHAT_TRANSITION_STATUSES)[number])
          ) {
            setActiveTransaction(latest)
          } else {
            setActiveTransaction(null)
          }
        }
        setTransactionStatusLoading(false)
      } else {
        setTransactionRows([])
        setTransactionStatus(null)
        setActiveTransaction(null)
        setTransactionStatusLoading(false)
      }
    }
    const id = window.setInterval(() => void tick(), 6000)
    return () => window.clearInterval(id)
  }, [skillId, supabase, loading, skill, userId, fetchActiveTransaction])

  useEffect(() => {
    if (!skillId || !userId) {
      return
    }
    const sync = async () => {
      setTransactionStatusLoading(true)
      const rows = await fetchActiveTransaction()
      if (rows !== undefined) {
        const latest = rows[0] ?? null
        const status = latest?.status ?? null
        setTransactionRows(rows)
        setTransactionStatus(status)
        if (
          latest?.id != null &&
          status &&
          CHAT_TRANSITION_STATUSES.includes(status as (typeof CHAT_TRANSITION_STATUSES)[number])
        ) {
          setActiveTransaction(latest)
        } else {
          setActiveTransaction(null)
        }
      }
      setTransactionStatusLoading(false)
    }
    const onFocus = () => {
      void sync()
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void sync()
      }
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [skillId, userId, fetchActiveTransaction])

  useEffect(() => {
    if (!skillId || !userId || !consultationSettings?.is_enabled) {
      return
    }
    let cancelled = false
    const reload = async () => {
      const next = await fetchMyConsultationAnswer(supabase, skillId, userId)
      if (!cancelled) {
        setConsultationAnswer(next)
      }
    }
    const id = window.setInterval(() => {
      void reload()
    }, 7000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [consultationSettings?.is_enabled, skillId, supabase, userId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
        <span className="ml-2 text-sm">読み込み中...</span>
      </div>
    )
  }

  if (!skill) {
    return (
      <div className="min-h-screen bg-black px-4 py-16 text-center text-zinc-200">
        <p className="text-lg font-semibold text-white">スキルが見つかりません</p>
        <p className="mt-2 text-sm text-zinc-400">URL をご確認ください。</p>
        <Button asChild className="mt-8 bg-red-600 text-white hover:bg-red-500">
          <Link href="/" scroll={false}>
            ホームへ戻る
          </Link>
        </Button>
      </div>
    )
  }

  const profile = normalizeProfile(skill.profiles)
  const instructorName = profile?.display_name?.trim() || "講師"
  const instructorAvatarSrc = resolveProfileAvatarUrl(profile?.avatar_url ?? null, instructorName)
  const hasInstructorRating =
    profile?.rating_avg != null &&
    Number.isFinite(Number(profile.rating_avg)) &&
    profile.review_count != null &&
    Number.isFinite(Number(profile.review_count)) &&
    profile.review_count > 0
  const maxCap = Math.max(0, Math.floor(Number(skill.max_capacity)))
  const enrolled = Math.max(0, Math.floor(Number(enrolledCount)))
  /** 申し込み人数が対応可能人数以上なら満枠（0 名と 0 名が同じ場合も含む） */
  const isFull = enrolled >= maxCap
  const thumbSrc = resolveSkillThumbnailUrl(skill.thumbnail_url)
  const isOwnSkill = Boolean(userId && skill.user_id === userId)
  const latestTransaction = transactionRows[0] ?? null
  const latestTransactionStatus = transactionStatus ?? latestTransaction?.status ?? null
  const canTransitionChatByStatus =
    latestTransactionStatus === "pending" ||
    latestTransactionStatus === "in_progress" ||
    latestTransactionStatus === "active" ||
    latestTransactionStatus === "approval_pending" ||
    latestTransactionStatus === "disputed"
  const canRepurchaseByStatus =
    latestTransactionStatus === "completed" ||
    latestTransactionStatus === "canceled" ||
    latestTransactionStatus === "refunded"
  const hasActivePurchase = !isOwnSkill && Boolean(latestTransaction?.id != null && canTransitionChatByStatus)
  const isBuyerAwaitingPayment =
    Boolean(
      userId &&
        latestTransaction?.buyer_id === userId &&
        latestTransactionStatus === "awaiting_payment",
    )
  const consultationEnabled = consultationSettings?.is_enabled === true
  const consultationAccepted = consultationAnswer?.status === "accepted"
  const shouldShowConsultationAction = !isOwnSkill && consultationEnabled && !consultationAccepted
  const shouldShowPurchaseButton =
    !isOwnSkill &&
    !transactionStatusLoading &&
    (!consultationEnabled || consultationAccepted) &&
    (transactionRows.length === 0 || canRepurchaseByStatus || isBuyerAwaitingPayment)

  console.log("[skills:purchase-button-state]", {
    rowsLength: transactionRows.length,
    status: latestTransactionStatus,
    transactionStatusLoading,
    hasActivePurchase,
    shouldShowPurchaseButton,
    consultationEnabled,
    consultationAccepted,
  })

  const handlePurchaseIntent = () => {
    setPurchaseError(null)
    if (isFull || isOwnSkill) {
      return
    }
    if (!userId) {
      router.push(`/login?redirect=${encodeURIComponent(`/skills/${skillId}`)}`)
      return
    }
    if (transactionStatusLoading) {
      setPurchaseError("取引状態を確認中です。少し待ってから再度お試しください。")
      return
    }
    if (hasActivePurchase && latestTransaction?.id != null) {
      router.push(`/chat/${String(latestTransaction.id)}`)
      return
    }
    setPurchaseConfirmKey((k) => k + 1)
    setPurchaseConfirmOpen(true)
  }

  const executePurchaseAfterConfirm = async () => {
    if (!skill || !userId) {
      setPurchaseConfirmOpen(false)
      return
    }
    setPurchasePending(true)
    setPurchaseProgressLabel("取引を作成中...")
    try {
      // insert 前の最終確認（ボタン表示の遅延と DB のずれ対策）
      const latestActive = await fetchLatestRelevantTransaction()

      if (latestActive === undefined) {
        setPurchaseError(
          formatErrorMessageOnly({ message: "取引の確認に失敗しました。" }, isAdmin, {
            unknownErrorMessage: "取引の確認に失敗しました。",
          }),
        )
        return
      }

      const latestActiveRow = (latestActive as ActiveTransactionRow[] | null)?.[0]
      const latestStatus = latestActiveRow?.status ?? null
      if (
        latestActiveRow &&
        latestActiveRow.id &&
        latestStatus &&
        CHAT_TRANSITION_STATUSES.includes(latestStatus as (typeof CHAT_TRANSITION_STATUSES)[number])
      ) {
        setTransactionRows([latestActiveRow])
        setTransactionStatus(latestStatus)
        setActiveTransaction(latestActiveRow)
        setPurchaseProgressLabel("チャットへ移動中...")
        router.push(`/chat/${String(latestActiveRow.id)}`)
        return
      }

      if (
        latestActiveRow &&
        latestActiveRow.id &&
        latestStatus === "awaiting_payment" &&
        latestActiveRow.buyer_id === userId
      ) {
        setTransactionRows([latestActiveRow])
        setTransactionStatus(latestStatus)
        const ok = await startStripePaymentForTransaction(String(skill.id))
        if (!ok) {
          setPurchaseError("決済の開始に失敗しました。もう一度お試しください。")
          return
        }
        setPurchaseConfirmOpen(false)
        return
      }

      if (Number(skill.price) > 0) {
        const ok = await startStripePaymentForTransaction(String(skill.id))
        if (!ok) {
          setPurchaseError("決済の開始に失敗しました。もう一度お試しください。")
          return
        }
        setPurchaseConfirmOpen(false)
        return
      }

      const { inserted, errorMessage, transactionId, requiresPayment } = await createSkillPurchaseTransaction(
        supabase,
        {
          skillId: skillId,
          buyerId: userId,
          sellerId: skill.user_id,
        },
      )

      if (errorMessage || !inserted) {
        if (!errorMessage) {
          setPurchaseError("取引の作成に失敗しました。")
          return
        }
        setPurchaseError(
          formatErrorMessageOnly({ message: errorMessage }, isAdmin, {
            unknownErrorMessage: "取引の作成に失敗しました。",
          }),
        )
        return
      }

      if (requiresPayment && transactionId) {
        const ok = await startStripePaymentForTransaction(String(skill.id))
        if (!ok) {
          setPurchaseError("決済の開始に失敗しました。もう一度お試しください。")
          return
        }
        setPurchaseConfirmOpen(false)
        return
      } else if (transactionId) {
        setPurchaseProgressLabel("チャットへ移動中...")
        router.push(`/chat/${transactionId}`)
        return
      }

      setPurchaseProgressLabel("取引情報を更新中...")
      let refreshed: ActiveTransactionRow | null = null
      for (let i = 0; i < 10; i += 1) {
        const refreshedRows = await fetchActiveTransaction()
        if (refreshedRows === undefined) {
          continue
        }
        const latest = refreshedRows[0] ?? null
        const status = latest?.status ?? null
        if (
          latest?.id != null &&
          status &&
          CHAT_TRANSITION_STATUSES.includes(status as (typeof CHAT_TRANSITION_STATUSES)[number])
        ) {
          refreshed = latest
          setTransactionRows(refreshedRows)
          setTransactionStatus(status)
          break
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }

      if (!refreshed || refreshed.id == null) {
        setPurchaseError("取引の反映待ちに失敗しました。時間をおいて再度お試しください。")
        return
      }

      setActiveTransaction(refreshed)
      setPurchaseProgressLabel("チャットへ移動中...")
      router.push(`/chat/${String(refreshed.id)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "取引の作成に失敗しました。"
      setPurchaseError(
        formatErrorMessageOnly({ message: msg }, isAdmin, {
          unknownErrorMessage: "取引の作成に失敗しました。",
        }),
      )
    } finally {
      setPurchasePending(false)
      setPurchaseProgressLabel("読み込み中...")
      setPurchaseConfirmOpen(false)
    }
  }

  const consultationLabel = {
    q1: consultationSettings?.q1_label?.trim() || "",
    q2: consultationSettings?.q2_label?.trim() || "",
    q3: consultationSettings?.q3_label?.trim() || "",
    free: consultationSettings?.free_label?.trim() || "",
  }
  const showConsultationQ1 = consultationLabel.q1.trim().length > 0
  const showConsultationQ2 = consultationLabel.q2.trim().length > 0
  const showConsultationQ3 = consultationLabel.q3.trim().length > 0
  const showConsultationFree = consultationLabel.free.trim().length > 0
  const consultationAnswerPlaceholders = {
    q1: "例 : 現在の悩みを教えてください",
    q2: "例 : 目標を教えてください",
    q3: "例 : これまでの運動経験を教えてください",
    free: "例 : その他、事前に伝えておきたいこと",
  }

  const handleConsultationSubmit = async () => {
    if (!skillId || !consultationEnabled) {
      return
    }
    if (isSubmitting) {
      return
    }
    if (!userId) {
      router.push(`/login?redirect=${encodeURIComponent(`/skills/${skillId}`)}`)
      return
    }
    const skillIdNumber = toConsultationSkillId(skillId)
    if (skillIdNumber == null) {
      setPurchaseError("スキルIDの形式が不正です。")
      return
    }
    const a1 = consultationForm.a1.trim()
    const a2 = consultationForm.a2.trim()
    const a3 = consultationForm.a3.trim()
    const free = consultationForm.free.trim()
    if (
      (showConsultationQ1 && !a1) ||
      (showConsultationQ2 && !a2) ||
      (showConsultationQ3 && !a3) ||
      (showConsultationFree && !free)
    ) {
      setPurchaseError("表示されている相談項目はすべて入力してください。")
      return
    }
    setPurchaseError(null)
    setIsSubmitting(true)
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      const authUserId = authUser?.id ?? null
      if (authError || !authUserId) {
        setPurchaseError("ログイン情報を確認できませんでした。再ログインしてください。")
        return
      }
      if (authUserId !== userId) {
        setPurchaseError("認証ユーザー情報が更新されました。ページを再読み込みしてから再度お試しください。")
        return
      }
      const existingAnswer = await fetchMyConsultationAnswer(supabase, skillIdNumber, authUserId)
      if (existingAnswer?.status === "pending") {
        setConsultationAnswer(existingAnswer)
        setConsultationFormOpen(false)
        setPurchaseError("このスキルは承認待ちです。承認または拒否まで再送できません。")
        return
      }
      const sellerId = skill?.user_id ?? null
      if (!sellerId) {
        setPurchaseError("講師情報を確認できませんでした。ページを再読み込みして再度お試しください。")
        return
      }

      const { data, error } = await supabase
        .from("consultation_answers")
        .insert(
          {
            skill_id: skillIdNumber,
            buyer_id: authUserId,
            seller_id: sellerId,
            a1_text: a1,
            a2_text: a2,
            a3_text: a3,
            free_text: free,
            status: "pending",
          },
        )
        .select("id, skill_id, buyer_id, seller_id, a1_text, a2_text, a3_text, free_text, status")
        .single()
      if (error || !data) {
        if (error) {
          console.error("[consultation_answers.insert] failed", {
            message: error.message,
            code: (error as { code?: string }).code ?? null,
            details: (error as { details?: string }).details ?? null,
            hint: (error as { hint?: string }).hint ?? null,
            payload: {
              skill_id: skillIdNumber,
              buyer_id: authUserId,
              seller_id: sellerId,
              has_a1_text: a1.length > 0,
              has_a2_text: a2.length > 0,
              has_a3_text: a3.length > 0,
              has_free_text: free.length > 0,
            },
          })
        }
        setPurchaseError("相談リクエストの送信に失敗しました。")
        return
      }
      setConsultationAnswer((data as ConsultationAnswerRow) ?? {
        id: "",
        skill_id: skillIdNumber,
        buyer_id: authUserId,
        seller_id: sellerId,
        a1_text: a1,
        a2_text: a2,
        a3_text: a3,
        free_text: free,
        status: "pending",
      })
      setConsultationFormOpen(false)
      const { error: notifError } = await createGeneralNotification(supabase, {
        recipient_id: sellerId,
        sender_id: authUserId,
        type: "consultation_request",
        title: skill?.title?.trim() || "事前オファー",
        reason: `skill_id:${skillIdNumber}`,
        content: "事前オファーの申し込みが届いています。受講リクエストをご確認ください。",
      })
      if (notifError) {
        console.error("[consultation_request notification] failed", {
          message: notifError.message,
          details: notifError.details ?? null,
          code: notifError.code ?? null,
        })
      }
      setNotice({
        variant: "success",
        message: "リクエストを送信しました。講師の承認をお待ちください",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black pb-24 pt-6 text-zinc-100">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <Button
          asChild
          variant="outline"
          className="mb-6 border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
        >
          <Link href="/" scroll={false} className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            一覧へ戻る
          </Link>
        </Button>

        <div className="overflow-hidden rounded-2xl border border-red-500/30 bg-zinc-950 shadow-[0_0_60px_rgba(198,40,40,0.15)]">
          <div className="relative aspect-[16/10] w-full bg-zinc-900">
            <Image
              src={thumbSrc}
              alt=""
              fill
              className="object-cover"
              priority
              unoptimized
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="inline-block rounded-full border border-red-500/40 bg-black/50 px-3 py-1 text-xs font-semibold text-red-300 backdrop-blur-sm">
                {skill.category}
              </span>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">{skill.title}</h1>
            </div>
          </div>

          <div className="space-y-8 p-6 md:p-8">
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-red-400">講師</h2>
              <Link
                href={`/profile/${skill.user_id}`}
                className="flex items-center gap-4 rounded-xl border border-red-500/30 bg-zinc-900/70 p-4 transition-colors hover:border-red-500/55 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-red-500/25">
                  <Image
                    src={instructorAvatarSrc}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="56px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-white">{instructorName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-400">
                    {hasInstructorRating ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-zinc-200">
                          <Star className="h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500" aria-hidden />
                          <span className="font-semibold text-white">
                            {Number(profile?.rating_avg).toFixed(1)}
                          </span>
                        </span>
                        <span className="text-zinc-500">·</span>
                        <span>レビュー {profile?.review_count} 件</span>
                      </>
                    ) : (
                      <span className="text-zinc-500">評価なし</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
              </Link>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">価格</h2>
              <p className="text-3xl font-black text-white">
                ¥{skill.price.toLocaleString()}
                <span className="ml-2 text-base font-semibold text-zinc-500">/ 回</span>
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">説明</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{skill.description}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">こんな人におすすめ</h2>
              <p className="text-sm leading-relaxed text-zinc-300">{skill.target_audience}</p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">形式</h2>
                  <p className="mt-1 font-semibold text-white">{formatLessonFormat(skill.format)}</p>
                </div>
              </section>
              <section className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">場所</h2>
                  <p className="mt-1 font-semibold text-white">{formatLocation(skill)}</p>
                </div>
              </section>
            </div>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">対応人数</h2>
                    <p className="mt-1 text-lg font-bold text-white">
                      対応可能人数: <span className="text-red-400">{maxCap}</span> 名
                    </p>
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-sm text-zinc-300">
                      現在の申し込み人数: <span className="font-semibold text-white">{enrolled}</span> 名
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-1 text-sm text-zinc-400">
              <p>
                1回あたりの時間: <span className="font-medium text-zinc-200">{skill.duration_minutes}分</span>
              </p>
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 z-10 mt-8 border-t border-zinc-800 bg-black/90 py-4 backdrop-blur-md md:static md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
          {purchaseError ? (
            <p className="mb-3 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
              {purchaseError}
            </p>
          ) : null}
          {isOwnSkill ? (
            <Button
              type="button"
              disabled
              className="h-12 w-full rounded-md bg-zinc-700 text-base font-bold text-zinc-200"
            >
              自分のスキルです
            </Button>
          ) : hasActivePurchase && latestTransaction ? (
            <Button
              asChild
              className="h-12 w-full rounded-md border border-red-500/40 bg-zinc-900 text-base font-bold text-white shadow-sm transition-all duration-300 ease-out hover:border-red-500 hover:bg-zinc-800"
            >
              <Link
                href={`/chat/${String(latestTransaction.id)}`}
                className="inline-flex w-full items-center justify-center"
              >
                <MessageCircle className="mr-2 h-5 w-5 shrink-0" aria-hidden />
                プログラムを確認する（チャットへ）
              </Link>
            </Button>
          ) : shouldShowConsultationAction ? (
            <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-4">
              {consultationAnswer?.status === "pending" ? (
                <Button
                  type="button"
                  disabled
                  className="h-11 w-full rounded-md bg-zinc-700 text-base font-bold text-zinc-200"
                >
                  承認待ち
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setConsultationFormOpen((prev) => !prev)}
                  className="h-11 w-full rounded-md bg-red-600 text-base font-bold text-white hover:bg-red-500"
                >
                  {consultationFormOpen ? "入力フォームを閉じる" : "申し込む"}
                </Button>
              )}
              {consultationAnswer?.status === "rejected" ? (
                <p className="text-sm text-amber-300">リクエストは拒否されました。</p>
              ) : null}
              {consultationFormOpen && consultationAnswer?.status !== "pending" ? (
                <div className="space-y-3 rounded-md border border-zinc-700 bg-black/30 p-3">
                  {showConsultationQ1 ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">{consultationLabel.q1}</label>
                      <textarea
                        rows={3}
                        value={consultationForm.a1}
                        onChange={(event) => setConsultationForm((prev) => ({ ...prev, a1: event.target.value }))}
                        placeholder={consultationAnswerPlaceholders.q1}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}
                  {showConsultationQ2 ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">{consultationLabel.q2}</label>
                      <textarea
                        rows={3}
                        value={consultationForm.a2}
                        onChange={(event) => setConsultationForm((prev) => ({ ...prev, a2: event.target.value }))}
                        placeholder={consultationAnswerPlaceholders.q2}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}
                  {showConsultationQ3 ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">{consultationLabel.q3}</label>
                      <textarea
                        rows={3}
                        value={consultationForm.a3}
                        onChange={(event) => setConsultationForm((prev) => ({ ...prev, a3: event.target.value }))}
                        placeholder={consultationAnswerPlaceholders.q3}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}
                  {showConsultationFree ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-400">{consultationLabel.free}</label>
                      <textarea
                        rows={4}
                        value={consultationForm.free}
                        onChange={(event) => setConsultationForm((prev) => ({ ...prev, free: event.target.value }))}
                        placeholder={consultationAnswerPlaceholders.free}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleConsultationSubmit()}
                    className="h-10 w-full rounded-md bg-red-600 text-sm font-bold text-white hover:bg-red-500"
                  >
                    {isSubmitting ? "送信中..." : "リクエストを送信"}
                  </Button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="w-full text-center text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
              >
                この商品を通報する
              </button>
            </div>
          ) : shouldShowPurchaseButton ? (
            <div className="space-y-3">
              <Button
                type="button"
                disabled={isFull || isOwnSkill || purchasePending}
                onClick={handlePurchaseIntent}
                className={cn(
                  "h-12 w-full rounded-md text-base font-bold shadow-sm transition-all duration-300 ease-out",
                  isFull || isOwnSkill
                    ? "cursor-not-allowed !bg-gray-600 !text-zinc-100 hover:!bg-gray-600 disabled:!opacity-100"
                    : "bg-red-600 text-white hover:bg-red-500 active:scale-[0.99]",
                )}
              >
                {isFull
                  ? "満枠対応中"
                  : purchasePending
                    ? purchaseProgressLabel
                    : isBuyerAwaitingPayment
                      ? "お支払いを完了する"
                      : "購入する"}
              </Button>
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="w-full text-center text-xs text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
              >
                この商品を通報する
              </button>
            </div>
          ) : transactionStatusLoading ? (
            <Button
              type="button"
              disabled
              className="h-12 w-full rounded-md bg-zinc-700 text-base font-bold text-zinc-200"
            >
              取引状態を確認中...
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              className="h-12 w-full rounded-md bg-zinc-700 text-base font-bold text-zinc-200"
            >
              取引状態を確認できませんでした
            </Button>
          )}
        </div>
        <StripePaymentSheet
          open={stripePaymentOpen}
          onClose={() => setStripePaymentOpen(false)}
          clientSecret={stripeClientSecret}
          publishableKey={stripePublishableKey}
          returnUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/skills/${skillId}`
              : `/skills/${skillId}`
          }
          onPaid={async () => {
            setStripePaymentOpen(false)
            setPurchaseProgressLabel("取引を確認中...")
            let refreshed: ActiveTransactionRow | null = null
            for (let i = 0; i < 20; i += 1) {
              const refreshedRows = await fetchActiveTransaction()
              if (refreshedRows === undefined) {
                continue
              }
              const latest = refreshedRows[0] ?? null
              const status = latest?.status ?? null
              if (
                latest?.id != null &&
                status &&
                CHAT_TRANSITION_STATUSES.includes(status as (typeof CHAT_TRANSITION_STATUSES)[number])
              ) {
                refreshed = latest
                setTransactionRows(refreshedRows)
                setTransactionStatus(status)
                break
              }
              await new Promise((resolve) => window.setTimeout(resolve, 250))
            }
            if (!refreshed || refreshed.id == null) {
              setPurchaseError(
                "支払いは完了した可能性があります。マイページの取引からチャットを開くか、しばらくしてから再度お試しください。",
              )
              return
            }
            setActiveTransaction(refreshed)
            router.push(`/chat/${String(refreshed.id)}`)
          }}
        />

        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          type="product"
          targetId={skill.id}
          onSuccess={(message) => setNotice({ variant: "success", message })}
        />

        {legalPortalReady &&
          purchaseConfirmOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/60 p-4 sm:p-6"
              role="presentation"
              onClick={() => {
                if (!purchasePending) {
                  setPurchaseConfirmOpen(false)
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="final-confirm-purchase-title"
                className="my-auto w-full max-w-lg shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="final-confirm-purchase-title" className="text-center text-base font-semibold text-zinc-100">
                  最終確認
                </h2>
                <p className="mt-1 text-center text-xs text-zinc-500">購入前の注意事項に同意して、取引を開始してください。</p>
                <div className="mt-5">
                  <TradeFinalConfirmStep
                    variant="buyer"
                    resetKey={purchaseConfirmKey}
                    actionLabel="購入する"
                    isLoading={purchasePending}
                    showCancelButton
                    cancelLabel="戻る"
                    onCancel={() => {
                      if (!purchasePending) {
                        setPurchaseConfirmOpen(false)
                      }
                    }}
                    onConfirm={() => void executePurchaseAfterConfirm()}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}
