"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Heart, Loader2, Pencil, Star } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  canChangeDisplayNameAfterCooldown,
  formatDateYmdSlashes,
  getNextDisplayNameChangeEligibleAt,
  parseProfileDate,
} from "@/lib/display-name-policy"
import { normalizeProfileCategory } from "@/lib/profile-fields"
import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { getIsAdminFromProfile } from "@/lib/admin"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import {
  fetchProfileRatingData,
  type ProfileRatingComment,
  type ProfileRatingDistribution,
} from "@/lib/profile-ratings"
import { createGeneralNotification } from "@/lib/transaction-notifications"
import { autoCompleteTransactions } from "@/lib/transactions"
import { checkAndFinalizeStripeStatus, getStripeOnboardingUrl } from "@/actions/stripe"

type MypageSection =
  | "profile"
  | "listings"
  | "requests"
  | "learning"
  | "teaching"
  | "transactions"
  | "favorites"
  | "reviews"
  | "payout"
  | "account"

const MENU: { id: MypageSection; label: string }[] = [
  { id: "profile", label: "プロフィール設定" },
  { id: "listings", label: "出品商品管理" },
  { id: "requests", label: "受講リクエスト" },
  { id: "learning", label: "受講中" },
  { id: "teaching", label: "対応中" },
  { id: "transactions", label: "取引履歴" },
  { id: "favorites", label: "お気に入り" },
  { id: "reviews", label: "評価" },
  { id: "payout", label: "売上・振込設定" },
  { id: "account", label: "アカウント設定" },
]

const STAR_LEVELS: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1]
const HISTORY_PAGE_SIZE = 15

function createEmptyDistribution(): ProfileRatingDistribution {
  return {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
}

function formatRatingDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function isMypageSection(value: string | null): value is MypageSection {
  if (!value) {
    return false
  }
  return MENU.some((item) => item.id === value)
}

type ListedSkill = {
  id: string
  title: string
  category: string | null
  price: number
  created_at: string | null
  is_published: boolean | null
}

/** favorites 行 + 紐づく skills（一覧表示用） */
type FavoriteSkillItem = {
  favoriteId: string
  id: string
  title: string
  price: number
  imageUrl: string
}

type TransactionListRow = {
  id: string
  buyer_id: string
  seller_id: string
  created_at: string | null
  skills: { id: string; title: string } | { id: string; title: string }[] | null
}

type TransactionHistoryListRow = TransactionListRow & {
  status: string
  completed_at: string | null
}

type MypageTransactionItem = {
  transactionId: string
  skillId: string
  skillTitle: string
  peerDisplayName: string
  peerAvatarUrl: string
}

type MypageHistoryTransactionItem = MypageTransactionItem & {
  statusLabel: string
  completedAtLabel: string
}

type ConsultationRequestStatus = "pending" | "accepted" | "rejected"
type ConsultationRequestViewFilter = "pending" | "handled" | "all"

type ConsultationRequestItem = {
  id: string
  skillId: number
  skillTitle: string
  buyerId: string
  sellerId: string
  buyerDisplayName: string
  buyerAvatarUrl: string
  q1Label: string
  q2Label: string
  q3Label: string
  freeLabel: string
  a1Text: string
  a2Text: string
  a3Text: string
  freeText: string
  status: ConsultationRequestStatus
}

type SentConsultationRequestItem = {
  id: string
  skillId: number
  skillTitle: string
  sellerId: string
  sellerDisplayName: string
  sellerAvatarUrl: string
  transactionId: string | null
  status: ConsultationRequestStatus
  rejectionReason: string
}

type ConnectBalanceResponse = {
  registered: boolean
  total: number
  pending: number
  available: number
  currency: string
  error?: string
}

function parseSkillIdFromNotificationReason(reason: string | null): number | null {
  const value = reason?.trim()
  if (!value) {
    return null
  }
  const match = value.match(/^skill_id:(\d+)$/)
  if (!match) {
    return null
  }
  const n = Number(match[1])
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function extractRejectionReasonFromContent(content: string | null): string {
  const text = content?.trim()
  if (!text) {
    return ""
  }
  const marker = "理由:"
  const idx = text.indexOf(marker)
  if (idx < 0) {
    return ""
  }
  return text.slice(idx + marker.length).trim()
}

function historyStatusLabel(status: string): string {
  if (status === "canceled" || status === "refunded") {
    return "取引完了（返金/キャンセル済み）"
  }
  if (status === "completed") {
    return "取引完了"
  }
  return status
}

function formatHistoryCompletedAtLabel(completedAt: string | null, createdAt: string | null): string {
  const raw = completedAt ?? createdAt
  if (!raw) {
    return "完了日時: -"
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return "完了日時: -"
  }
  const text = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
  return `完了日時: ${text}`
}

export default function MypageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const sectionParam = searchParams.get("tab")
  const section: MypageSection = isMypageSection(sectionParam) ? sectionParam : "profile"
  const stripeReturnParam = searchParams.get("stripe")
  const updatedParam = searchParams.get("updated")

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [savedDisplayName, setSavedDisplayName] = useState("")
  const [lastNameChange, setLastNameChange] = useState<Date | null>(null)
  const [bio, setBio] = useState("")
  const [fitnessHistory, setFitnessHistory] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [profileRatingAvg, setProfileRatingAvg] = useState<number | null>(null)
  const [profileReviewCount, setProfileReviewCount] = useState(0)

  const [listings, setListings] = useState<ListedSkill[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [publishingListingId, setPublishingListingId] = useState<string | null>(null)

  const [favoriteSkills, setFavoriteSkills] = useState<FavoriteSkillItem[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  const [favoritesError, setFavoritesError] = useState<string | null>(null)
  const [reviewDistribution, setReviewDistribution] = useState<ProfileRatingDistribution>(createEmptyDistribution())
  const [reviewComments, setReviewComments] = useState<ProfileRatingComment[]>([])
  const [selectedReviewStars, setSelectedReviewStars] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsError, setReviewsError] = useState<string | null>(null)

  const [transactionItems, setTransactionItems] = useState<MypageTransactionItem[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)

  const [historyTransactionItems, setHistoryTransactionItems] = useState<MypageHistoryTransactionItem[]>([])
  const [historyTransactionsLoading, setHistoryTransactionsLoading] = useState(false)
  const [historyTransactionsError, setHistoryTransactionsError] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [consultationRequests, setConsultationRequests] = useState<ConsultationRequestItem[]>([])
  const [consultationRequestsLoading, setConsultationRequestsLoading] = useState(false)
  const [consultationRequestsError, setConsultationRequestsError] = useState<string | null>(null)
  const [sentConsultationRequests, setSentConsultationRequests] = useState<SentConsultationRequestItem[]>([])
  const [sentConsultationRequestsLoading, setSentConsultationRequestsLoading] = useState(false)
  const [sentConsultationRequestsError, setSentConsultationRequestsError] = useState<string | null>(null)
  const [consultationActionBusyId, setConsultationActionBusyId] = useState<string | null>(null)
  const [consultationRequestViewFilter, setConsultationRequestViewFilter] =
    useState<ConsultationRequestViewFilter>("pending")
  const [rejectConfirmTargetId, setRejectConfirmTargetId] = useState<string | null>(null)
  const [rejectOptionalReason, setRejectOptionalReason] = useState("")

  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [isStripeRegistered, setIsStripeRegistered] = useState(false)
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState("")
  const [payoutLinkBusy, setPayoutLinkBusy] = useState(false)
  const [connectBalanceLoading, setConnectBalanceLoading] = useState(false)
  const [connectBalanceError, setConnectBalanceError] = useState<string | null>(null)
  const [connectBalance, setConnectBalance] = useState<ConnectBalanceResponse | null>(null)
  const filteredReviewComments =
    selectedReviewStars == null
      ? reviewComments
      : reviewComments.filter((comment) => comment.rating === selectedReviewStars)

  const handleSectionChange = useCallback(
    (nextSection: MypageSection) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextSection === "profile") {
        params.delete("tab")
      } else {
        params.set("tab", nextSection)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams],
  )

  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )
  }

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user) {
        router.replace("/login")
        return
      }
      setUserId(data.user.id)
      setAuthLoading(false)
      // 管理者判定は初期描画をブロックしないよう後段で反映する。
      void getIsAdminFromProfile(supabase, data.user.id).then((adminFlag) => {
        if (!mounted) {
          return
        }
        setIsAdmin(adminFlag)
      })
    }

    void checkAuth()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return
    }
    setProfileLoading(true)
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, bio, fitness_history, category, last_name_change, rating_avg, review_count, stripe_connect_account_id, is_stripe_registered",
      )
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "プロフィールの読み込みに失敗しました。" }),
      )
      setProfileLoading(false)
      return
    }

    const row = data as Record<string, unknown> | null
    const nameVal = row?.display_name
    const bioVal = row?.bio
    const fhVal = row?.fitness_history
    const rawLast = row?.last_name_change
    const ratingAvg = Number(row?.rating_avg)
    const reviewCount = Number(row?.review_count)
    const stripeAccountId = typeof row?.stripe_connect_account_id === "string" ? row.stripe_connect_account_id.trim() : ""
    const nameStr = typeof nameVal === "string" ? nameVal.trim() : ""
    setDisplayName(nameStr)
    setSavedDisplayName(nameStr)
    setLastNameChange(parseProfileDate(rawLast))
    setBio(typeof bioVal === "string" ? bioVal.trim() : "")
    setFitnessHistory(typeof fhVal === "string" ? fhVal.trim() : "")
    setSelectedCategories(
      normalizeProfileCategory(row?.category).filter((c) => c !== "フィットネス"),
    )
    setProfileRatingAvg(Number.isFinite(ratingAvg) ? ratingAvg : null)
    setProfileReviewCount(Number.isFinite(reviewCount) ? Math.max(0, Math.floor(reviewCount)) : 0)
    setIsStripeRegistered(row?.is_stripe_registered === true)
    setStripeConnectAccountId(stripeAccountId)

    setProfileLoading(false)
  }, [supabase, userId, isAdmin])

  useEffect(() => {
    if (!userId) {
      return
    }
    // プロフィール情報が必要なタブに入ったときのみ取得する。
    if (section === "profile" || section === "payout" || section === "reviews") {
      void loadProfile()
    }
  }, [userId, section, loadProfile])

  useEffect(() => {
    if (!userId || section !== "payout") {
      return
    }

    let cancelled = false
    const loadConnectBalance = async () => {
      setConnectBalanceLoading(true)
      setConnectBalanceError(null)
      try {
        const response = await fetch("/api/stripe/connect-balance", { method: "GET" })
        const payload = (await response.json()) as ConnectBalanceResponse
        if (cancelled) {
          return
        }
        if (!response.ok) {
          setConnectBalance(null)
          setConnectBalanceError(payload.error ?? "残高の取得に失敗しました。")
          return
        }
        setConnectBalance(payload)
      } catch {
        if (!cancelled) {
          setConnectBalance(null)
          setConnectBalanceError("残高の取得に失敗しました。")
        }
      } finally {
        if (!cancelled) {
          setConnectBalanceLoading(false)
        }
      }
    }

    void loadConnectBalance()
    return () => {
      cancelled = true
    }
  }, [userId, section, isStripeRegistered, stripeConnectAccountId])

  useEffect(() => {
    if (!userId || section !== "payout" || stripeReturnParam !== "return") {
      return
    }

    let cancelled = false
    const finalizeStripeStatus = async () => {
      try {
        const result = await checkAndFinalizeStripeStatus()
        if (cancelled || !result.finalized) {
          return
        }
        setNotice({ variant: "success", message: "Stripe連携が完了しました。" })
        router.replace("/mypage?tab=payout")
      } catch {
        if (!cancelled) {
          setNotice({
            variant: "error",
            message: "Stripe連携状態の確認に失敗しました。時間を置いて再度お試しください。",
          })
        }
      }
    }

    void finalizeStripeStatus()
    return () => {
      cancelled = true
    }
  }, [userId, section, stripeReturnParam, router])

  useEffect(() => {
    if (updatedParam !== "1") {
      return
    }
    setNotice({ variant: "success", message: "更新しました。" })
    const params = new URLSearchParams(searchParams.toString())
    params.delete("updated")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [updatedParam, searchParams, router, pathname])

  const handleStripeLinkOpen = useCallback(async () => {
    setPayoutLinkBusy(true)
    try {
      const url = await getStripeOnboardingUrl()
      window.location.href = url
    } finally {
      setPayoutLinkBusy(false)
    }
  }, [])

  const loadListings = useCallback(async () => {
    if (!userId) {
      return
    }
    setListingsLoading(true)
    setListingsError(null)
    const { data, error } = await supabase
      .from("skills")
      .select("id, title, category, price, created_at, is_published")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      setListings([])
      setListingsError("出品スキルの取得に失敗しました。")
    } else {
      setListings((data ?? []) as ListedSkill[])
    }
    setListingsLoading(false)
  }, [supabase, userId])

  const handlePublishListing = useCallback(async (skillId: string) => {
    if (!userId || publishingListingId) {
      return
    }
    const target = listings.find((item) => item.id === skillId)
    const confirmed = window.confirm(
      `「${target?.title ?? "このスキル"}」を公開しますか？`,
    )
    if (!confirmed) {
      return
    }
    setPublishingListingId(skillId)
    const { error } = await supabase
      .from("skills")
      .update({ is_published: true })
      .eq("id", skillId)
      .eq("user_id", userId)
    setPublishingListingId(null)

    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "スキルの公開に失敗しました。" }))
      return
    }

    setListings((prev) =>
      prev.map((item) => (item.id === skillId ? { ...item, is_published: true } : item)),
    )
    setNotice({ variant: "success", message: "スキルを公開しました。" })
  }, [supabase, userId, publishingListingId, isAdmin, listings])

  useEffect(() => {
    if (userId && section === "listings") {
      void loadListings()
    }
  }, [userId, section, loadListings])

  const loadConsultationRequests = useCallback(async () => {
    if (!userId) {
      return
    }
    setConsultationRequestsLoading(true)
    setConsultationRequestsError(null)
    try {
      const { data: mySkills, error: mySkillsError } = await supabase
        .from("skills")
        .select("id, title")
        .eq("user_id", userId)
      if (mySkillsError) {
        setConsultationRequests([])
        setConsultationRequestsError("受講リクエストの取得に失敗しました。")
        return
      }
      const skillRows = (mySkills ?? []) as Array<{ id: string | number; title: string | null }>
      const skillIds = skillRows
        .map((row) => Number(row.id))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n))
      if (skillIds.length === 0) {
        setConsultationRequests([])
        return
      }

      const [answersResult, settingsResult] = await Promise.all([
        supabase
          .from("consultation_answers")
          .select("id, skill_id, buyer_id, seller_id, a1_text, a2_text, a3_text, free_text, status")
          .in("skill_id", skillIds)
          .order("id", { ascending: false }),
        supabase
          .from("consultation_settings")
          .select("skill_id, q1_label, q2_label, q3_label, free_label")
          .in("skill_id", skillIds),
      ])

      if (answersResult.error || settingsResult.error) {
        setConsultationRequests([])
        setConsultationRequestsError("受講リクエストの取得に失敗しました。")
        return
      }

      const answerRows = (answersResult.data ?? []) as Array<{
        id: string
        skill_id: number
        buyer_id: string
        seller_id: string
        a1_text: string | null
        a2_text: string | null
        a3_text: string | null
        free_text: string | null
        status: ConsultationRequestStatus
      }>
      const settingRows = (settingsResult.data ?? []) as Array<{
        skill_id: number
        q1_label: string | null
        q2_label: string | null
        q3_label: string | null
        free_label: string | null
      }>

      const buyerIds = [...new Set(answerRows.map((row) => row.buyer_id).filter((id) => id.length > 0))]
      const { data: buyers, error: buyersError } = buyerIds.length
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", buyerIds)
        : { data: [], error: null }

      if (buyersError) {
        setConsultationRequests([])
        setConsultationRequestsError("受講リクエストの取得に失敗しました。")
        return
      }

      const skillTitleById = new Map<number, string>()
      for (const row of skillRows) {
        const n = Number(row.id)
        if (!Number.isFinite(n)) {
          continue
        }
        skillTitleById.set(Math.trunc(n), row.title?.trim() || "スキル")
      }

      const settingsBySkillId = new Map<number, (typeof settingRows)[number]>()
      for (const row of settingRows) {
        settingsBySkillId.set(row.skill_id, row)
      }

      const buyerById = new Map<
        string,
        {
          display_name: string | null
          avatar_url: string | null
        }
      >()
      for (const row of (buyers ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
        buyerById.set(row.id, {
          display_name: row.display_name,
          avatar_url: row.avatar_url,
        })
      }

      const mapped: ConsultationRequestItem[] = answerRows.map((row) => {
        const setting = settingsBySkillId.get(row.skill_id)
        const buyer = buyerById.get(row.buyer_id)
        const buyerName = buyer?.display_name?.trim() || "名前未設定"
        return {
          id: row.id,
          skillId: row.skill_id,
          skillTitle: skillTitleById.get(row.skill_id) ?? "スキル",
          buyerId: row.buyer_id,
          sellerId: row.seller_id,
          buyerDisplayName: buyerName,
          buyerAvatarUrl: resolveProfileAvatarUrl(buyer?.avatar_url ?? null, buyerName),
          q1Label: setting?.q1_label?.trim() || "",
          q2Label: setting?.q2_label?.trim() || "",
          q3Label: setting?.q3_label?.trim() || "",
          freeLabel: setting?.free_label?.trim() || "",
          a1Text: row.a1_text?.trim() || "",
          a2Text: row.a2_text?.trim() || "",
          a3Text: row.a3_text?.trim() || "",
          freeText: row.free_text?.trim() || "",
          status: row.status,
        }
      })
      setConsultationRequests(mapped)
    } finally {
      setConsultationRequestsLoading(false)
    }
  }, [supabase, userId])

  const loadSentConsultationRequests = useCallback(async () => {
    if (!userId) {
      return
    }
    setSentConsultationRequestsLoading(true)
    setSentConsultationRequestsError(null)
    try {
      const answersWithReason = await supabase
        .from("consultation_answers")
        .select("id, skill_id, seller_id, status, rejection_reason")
        .eq("buyer_id", userId)
        .order("id", { ascending: false })

      type AnswerRow = {
        id: string
        skill_id: number
        seller_id: string
        status: ConsultationRequestStatus
        rejection_reason?: string | null
      }

      let answerRows: AnswerRow[] = []
      let hasRejectionReasonColumn = false

      if (answersWithReason.error) {
        const answersWithoutReason = await supabase
          .from("consultation_answers")
          .select("id, skill_id, seller_id, status")
          .eq("buyer_id", userId)
          .order("id", { ascending: false })

        if (answersWithoutReason.error) {
          setSentConsultationRequests([])
          setSentConsultationRequestsError("送信済みリクエストの取得に失敗しました。")
          return
        }
        answerRows = (answersWithoutReason.data ?? []) as AnswerRow[]
      } else {
        answerRows = (answersWithReason.data ?? []) as AnswerRow[]
        hasRejectionReasonColumn = true
      }

      if (answerRows.length === 0) {
        setSentConsultationRequests([])
        return
      }

      const skillIds = [...new Set(answerRows.map((row) => row.skill_id).filter((n) => Number.isFinite(n)))]
      const sellerIds = [...new Set(answerRows.map((row) => row.seller_id).filter((id) => id?.length > 0))]

      const [skillsResult, sellersResult, rejectedNotificationsResult] = await Promise.all([
        skillIds.length
          ? supabase.from("skills").select("id, title").in("id", skillIds)
          : Promise.resolve({ data: [], error: null }),
        sellerIds.length
          ? supabase.from("profiles").select("id, display_name, avatar_url").in("id", sellerIds)
          : Promise.resolve({ data: [], error: null }),
        hasRejectionReasonColumn
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("notifications")
              .select("reason, content")
              .eq("recipient_id", userId)
              .eq("type", "consultation_rejected")
              .order("created_at", { ascending: false }),
      ])

      if (skillsResult.error || sellersResult.error || rejectedNotificationsResult.error) {
        setSentConsultationRequests([])
        setSentConsultationRequestsError("送信済みリクエストの取得に失敗しました。")
        return
      }

      const transactionsResult = await supabase
        .from("transactions")
        .select("id, skill_id, seller_id, created_at")
        .eq("buyer_id", userId)
        .in("skill_id", skillIds)
        .order("created_at", { ascending: false })

      if (transactionsResult.error) {
        setSentConsultationRequests([])
        setSentConsultationRequestsError("送信済みリクエストの取得に失敗しました。")
        return
      }

      const skillTitleById = new Map<number, string>()
      for (const row of (skillsResult.data ?? []) as Array<{ id: number | string; title: string | null }>) {
        const n = Number(row.id)
        if (!Number.isFinite(n)) {
          continue
        }
        skillTitleById.set(Math.trunc(n), row.title?.trim() || "スキル")
      }

      const sellerById = new Map<string, { display_name: string | null; avatar_url: string | null }>()
      for (const row of (sellersResult.data ?? []) as Array<{
        id: string
        display_name: string | null
        avatar_url: string | null
      }>) {
        sellerById.set(row.id, {
          display_name: row.display_name,
          avatar_url: row.avatar_url,
        })
      }

      const rejectionReasonBySkillId = new Map<number, string>()
      for (const row of (rejectedNotificationsResult.data ?? []) as Array<{ reason: string | null; content: string | null }>) {
        const skillId = parseSkillIdFromNotificationReason(row.reason)
        if (skillId == null || rejectionReasonBySkillId.has(skillId)) {
          continue
        }
        const extracted = extractRejectionReasonFromContent(row.content)
        if (extracted) {
          rejectionReasonBySkillId.set(skillId, extracted)
        }
      }

      const transactionIdBySkillSeller = new Map<string, string>()
      for (const row of (transactionsResult.data ?? []) as Array<{
        id: string
        skill_id: number
        seller_id: string
        created_at: string | null
      }>) {
        const key = `${row.skill_id}:${row.seller_id}`
        if (!transactionIdBySkillSeller.has(key)) {
          transactionIdBySkillSeller.set(key, row.id)
        }
      }

      const mapped: SentConsultationRequestItem[] = answerRows.map((row) => {
        const seller = sellerById.get(row.seller_id)
        const sellerName = seller?.display_name?.trim() || "講師"
        const dbReason = row.rejection_reason?.trim() || ""
        const fallbackReason = rejectionReasonBySkillId.get(row.skill_id) || ""
        const transactionId = transactionIdBySkillSeller.get(`${row.skill_id}:${row.seller_id}`) ?? null
        return {
          id: row.id,
          skillId: row.skill_id,
          skillTitle: skillTitleById.get(row.skill_id) ?? "スキル",
          sellerId: row.seller_id,
          sellerDisplayName: sellerName,
          sellerAvatarUrl: resolveProfileAvatarUrl(seller?.avatar_url ?? null, sellerName),
          transactionId,
          status: row.status,
          rejectionReason: dbReason || fallbackReason,
        }
      })
      setSentConsultationRequests(mapped)
    } finally {
      setSentConsultationRequestsLoading(false)
    }
  }, [supabase, userId])

  useEffect(() => {
    if (userId && section === "requests") {
      void loadConsultationRequests()
      void loadSentConsultationRequests()
    }
  }, [userId, section, loadConsultationRequests, loadSentConsultationRequests])

  const loadFavoriteSkills = useCallback(async () => {
    if (!userId) {
      return
    }
    setFavoritesLoading(true)
    setFavoritesError(null)

    const { data, error } = await supabase
      .from("favorites")
      .select(
        `
    id,
    skill_id,
    skills (
      id,
      title,
      price,
      thumbnail_url
    )
  `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      setFavoriteSkills([])
      setFavoritesError("お気に入りの取得に失敗しました。")
      setFavoritesLoading(false)
      return
    }

    type SkillEmbed = {
      id: string
      title: string
      price: number
      thumbnail_url: string | null
    }

    const rows = (data ?? []) as {
      id: string
      skill_id: string
      skills: SkillEmbed | SkillEmbed[] | null
    }[]

    const items: FavoriteSkillItem[] = []
    for (const row of rows) {
      const s = row.skills
      const skill = Array.isArray(s) ? s[0] : s
      if (!skill?.id) {
        continue
      }
      items.push({
        favoriteId: row.id,
        id: skill.id,
        title: skill.title,
        price: skill.price,
        imageUrl: resolveSkillThumbnailUrl(skill.thumbnail_url),
      })
    }

    setFavoriteSkills(items)
    setFavoritesLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (userId && section === "favorites") {
      void loadFavoriteSkills()
    }
  }, [userId, section, loadFavoriteSkills])

  useEffect(() => {
    if (!userId || section !== "reviews") {
      return
    }

    let cancelled = false
    const loadReviews = async () => {
      setReviewsLoading(true)
      setReviewsError(null)
      setSelectedReviewStars(null)
      const ratingData = await fetchProfileRatingData(supabase, userId)
      if (cancelled) {
        return
      }
      setReviewDistribution(ratingData.distribution)
      setReviewComments(ratingData.comments)
      setReviewsLoading(false)
    }
    void loadReviews().catch(() => {
      if (!cancelled) {
        setReviewDistribution(createEmptyDistribution())
        setReviewComments([])
        setReviewsError("評価データの取得に失敗しました。")
        setReviewsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [userId, section, supabase])

  useEffect(() => {
    if (!userId || (section !== "learning" && section !== "teaching")) {
      return
    }

    let cancelled = false

    const loadTransactionsForTab = async () => {
      setTransactionsLoading(true)
      setTransactionsError(null)

      try {
        const isLearning = section === "learning"
        if (isLearning) {
          await autoCompleteTransactions(supabase, { userId })
        }
        let query = supabase
          .from("transactions")
          .select("id, created_at, buyer_id, seller_id, skills ( id, title )")
          .in("status", ["active", "approval_pending", "disputed"])

        query = isLearning ? query.eq("buyer_id", userId) : query.eq("seller_id", userId)

        const { data: txRows, error: txError } = await query.order("created_at", { ascending: false })

        if (cancelled) {
          return
        }

        if (txError) {
          setTransactionItems([])
          setTransactionsError("取引一覧の取得に失敗しました。")
          return
        }

        const rows = (txRows ?? []) as TransactionListRow[]
        const peerIds = rows.map((r) => (isLearning ? r.seller_id : r.buyer_id))
        const uniquePeerIds = [...new Set(peerIds)]

        if (uniquePeerIds.length === 0) {
          setTransactionItems([])
          return
        }

        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", uniquePeerIds)

        if (cancelled) {
          return
        }

        if (profileError) {
          setTransactionItems([])
          setTransactionsError("相手プロフィールの取得に失敗しました。")
          return
        }

        type ProfileLite = { id: string; display_name: string | null; avatar_url: string | null }
        const profileById = new Map<string, ProfileLite>(
          (profileRows ?? []).map((p: ProfileLite) => [p.id, p]),
        )

        const items: MypageTransactionItem[] = []
        for (const row of rows) {
          const peerId = isLearning ? row.seller_id : row.buyer_id
          const prof = profileById.get(peerId)
          const name = prof?.display_name?.trim() ?? ""
          const s = row.skills
          const skill = Array.isArray(s) ? s[0] : s
          items.push({
            transactionId: row.id,
            skillId: skill?.id ?? "",
            skillTitle: skill?.title?.trim() ? skill.title : "スキル",
            peerDisplayName: name.length > 0 ? name : "名前未設定",
            peerAvatarUrl: resolveProfileAvatarUrl(prof?.avatar_url, name),
          })
        }

        setTransactionItems(items)
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false)
        }
      }
    }

    void loadTransactionsForTab()

    return () => {
      cancelled = true
    }
  }, [userId, section, supabase])

  useEffect(() => {
    if (!userId || section !== "transactions") {
      return
    }

    let cancelled = false

    const loadHistory = async () => {
      setHistoryTransactionsLoading(true)
      setHistoryTransactionsError(null)

      try {
        const { data: txRows, error: txError } = await supabase
          .from("transactions")
          .select("id, created_at, completed_at, buyer_id, seller_id, status, skills ( id, title )")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .in("status", ["completed", "canceled", "refunded"])
          .order("completed_at", { ascending: false })
          .order("created_at", { ascending: false })

        if (cancelled) {
          return
        }

        if (txError) {
          setHistoryTransactionItems([])
          setHistoryTransactionsError("取引履歴の取得に失敗しました。")
          return
        }

        const rows = (txRows ?? []) as TransactionHistoryListRow[]
        const peerIds = rows.map((r) => (r.buyer_id === userId ? r.seller_id : r.buyer_id))
        const uniquePeerIds = [...new Set(peerIds)]

        if (uniquePeerIds.length === 0) {
          setHistoryTransactionItems([])
          return
        }

        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", uniquePeerIds)

        if (cancelled) {
          return
        }

        if (profileError) {
          setHistoryTransactionItems([])
          setHistoryTransactionsError("相手プロフィールの取得に失敗しました。")
          return
        }

        type ProfileLite = { id: string; display_name: string | null; avatar_url: string | null }
        const profileById = new Map<string, ProfileLite>(
          (profileRows ?? []).map((p: ProfileLite) => [p.id, p]),
        )

        const items: MypageHistoryTransactionItem[] = []
        for (const row of rows) {
          const peerId = row.buyer_id === userId ? row.seller_id : row.buyer_id
          const prof = profileById.get(peerId)
          const name = prof?.display_name?.trim() ?? ""
          const s = row.skills
          const skill = Array.isArray(s) ? s[0] : s
          items.push({
            transactionId: row.id,
            skillId: skill?.id ?? "",
            skillTitle: skill?.title?.trim() ? skill.title : "スキル",
            peerDisplayName: name.length > 0 ? name : "名前未設定",
            peerAvatarUrl: resolveProfileAvatarUrl(prof?.avatar_url, name),
            statusLabel: historyStatusLabel(row.status),
            completedAtLabel: formatHistoryCompletedAtLabel(row.completed_at, row.created_at),
          })
        }

        setHistoryTransactionItems(items)
      } finally {
        if (!cancelled) {
          setHistoryTransactionsLoading(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [userId, section, supabase])

  const handleUnfavorite = async (favoriteId: string) => {
    if (!userId) {
      return
    }
    setFavoriteSkills((prev) => prev.filter((f) => f.favoriteId !== favoriteId))

    const { error } = await supabase.from("favorites").delete().eq("id", favoriteId).eq("user_id", userId)

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "お気に入りの解除に失敗しました。" }),
      )
      void loadFavoriteSkills()
    }
  }

  const handleAcceptConsultation = async (item: ConsultationRequestItem) => {
    setConsultationActionBusyId(item.id)
    const { error } = await supabase
      .from("consultation_answers")
      .update({
        status: "accepted",
      })
      .eq("id", item.id)
    setConsultationActionBusyId(null)
    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "承認に失敗しました。" }))
      return
    }
    const { error: notifError } = await createGeneralNotification(supabase, {
      recipient_id: item.buyerId,
      sender_id: item.sellerId,
      type: "consultation_accepted",
      title: item.skillTitle,
      reason: `skill_id:${item.skillId}`,
      content: "事前オファーの申し込みが承認されました。購入手続きを進められます。",
    })
    if (notifError) {
      console.error("[consultation_accepted notification] failed", {
        message: notifError.message,
        details: notifError.details ?? null,
        code: notifError.code ?? null,
      })
    }
    await loadConsultationRequests()
    setNotice({ variant: "success", message: "受講リクエストを承認しました。" })
  }

  const handleRejectConsultation = async (item: ConsultationRequestItem, reason: string) => {
    const reasonText = reason.trim()
    console.log("Update payload:", { status: "rejected", rejection_reason: reasonText })
    setConsultationActionBusyId(item.id)
    const { error } = await supabase
      .from("consultation_answers")
      .update({
        status: "rejected",
        rejection_reason: reasonText || null,
      })
      .eq("id", item.id)
    setConsultationActionBusyId(null)
    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "拒否に失敗しました。" }))
      return
    }
    const { error: notifError } = await createGeneralNotification(supabase, {
      recipient_id: item.buyerId,
      sender_id: item.sellerId,
      type: "consultation_rejected",
      title: item.skillTitle,
      reason: `skill_id:${item.skillId}`,
      content:
        reasonText.length > 0
          ? `事前オファーが見送られました。理由: ${reasonText}`
          : "事前オファーが見送られました。",
    })
    if (notifError) {
      console.error("[consultation_rejected notification] failed", {
        message: notifError.message,
        details: notifError.details ?? null,
        code: notifError.code ?? null,
      })
    }
    setRejectConfirmTargetId(null)
    setRejectOptionalReason("")
    await loadConsultationRequests()
    setNotice({ variant: "success", message: "受講リクエストを拒否しました。" })
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userId) {
      return
    }
    setNotice(null)
    setProfileSaving(true)

    const trimmedName = displayName.trim()
    const trimmedSaved = savedDisplayName.trim()
    const nameChangeRequested = trimmedName !== trimmedSaved
    const canChangeName = canChangeDisplayNameAfterCooldown(lastNameChange)

    const sharedFields = {
      bio: bio.trim() || null,
      fitness_history: fitnessHistory.trim() || null,
      category: selectedCategories,
    }

    if (nameChangeRequested && !canChangeName) {
      const { error } = await supabase.from("profiles").update(sharedFields).eq("id", userId)

      setProfileSaving(false)

      if (error) {
        setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "保存に失敗しました。" }))
        return
      }

      setDisplayName(savedDisplayName)
      setNotice({
        variant: "error",
        message: "名前の変更は30日に1回のみ可能です。表示名以外の内容を保存しました。",
      })
      await loadProfile()
      router.refresh()
      return
    }

    const updatePayload: Record<string, unknown> = {
      ...sharedFields,
      display_name: trimmedName || null,
    }

    if (nameChangeRequested && canChangeName) {
      updatePayload.last_name_change = new Date().toISOString()
    }

    const { error } = await supabase.from("profiles").update(updatePayload).eq("id", userId)

    setProfileSaving(false)

    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "保存に失敗しました。" }))
      return
    }

    setNotice({ variant: "success", message: "プロフィールを保存しました。" })
    await loadProfile()
    router.refresh()
  }

  const canChangeDisplayNameNow = canChangeDisplayNameAfterCooldown(lastNameChange)
  const nextEligibleAt = useMemo(
    () => getNextDisplayNameChangeEligibleAt(lastNameChange),
    [lastNameChange],
  )
  const isStripeSetupComplete = isStripeRegistered && stripeConnectAccountId.length > 0
  const filteredConsultationRequests = useMemo(() => {
    if (consultationRequestViewFilter === "all") {
      return consultationRequests
    }
    if (consultationRequestViewFilter === "handled") {
      return consultationRequests.filter((item) => item.status === "accepted" || item.status === "rejected")
    }
    return consultationRequests.filter((item) => item.status === "pending")
  }, [consultationRequestViewFilter, consultationRequests])
  const historyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(historyTransactionItems.length / HISTORY_PAGE_SIZE)),
    [historyTransactionItems.length],
  )
  const paginatedHistoryTransactionItems = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    const end = start + HISTORY_PAGE_SIZE
    return historyTransactionItems.slice(start, end)
  }, [historyPage, historyTransactionItems])
  const historyRangeStart = historyTransactionItems.length === 0 ? 0 : (historyPage - 1) * HISTORY_PAGE_SIZE + 1
  const historyRangeEnd = Math.min(historyPage * HISTORY_PAGE_SIZE, historyTransactionItems.length)
  const showNextChangeDate =
    lastNameChange != null && !canChangeDisplayNameNow && nextEligibleAt != null

  useEffect(() => {
    if (section === "transactions") {
      setHistoryPage(1)
    }
  }, [section])

  useEffect(() => {
    setHistoryPage((prev) => Math.min(prev, historyTotalPages))
  }, [historyTotalPages])

  const shouldBlockByProfileLoading =
    userId != null && (section === "profile" || section === "payout" || section === "reviews") && profileLoading

  if (authLoading || shouldBlockByProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
        読み込み中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <Header />

      <div className="mx-auto flex max-w-7xl flex-col md:min-h-[calc(100vh-4rem)] md:flex-row">
        {/* モバイル: 横スクロールメニュー */}
        <nav
          aria-label="マイページメニュー"
          className="sticky top-16 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:static md:top-0 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:bg-zinc-950 md:pt-6"
        >
          <div className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:gap-0 md:overflow-visible md:px-4 md:py-0">
            {MENU.map((item) => {
              const active = section === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSectionChange(item.id)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:rounded-md md:px-3 md:py-2.5 ${
                    active
                      ? "bg-red-950/50 text-red-300 ring-1 ring-red-500/40"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
            {isAdmin ? (
              <Button
                asChild
                className="mt-2 shrink-0 bg-red-600 text-xs font-bold text-white hover:bg-red-500 md:w-full"
              >
                <Link href="/admin">管理者ページへ</Link>
              </Button>
            ) : null}
          </div>
        </nav>

        <main className="flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <div className="mb-4 flex justify-end">
            <Button
              asChild
              variant="outline"
              className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
            >
              <Link href="/">トップページに戻る</Link>
            </Button>
          </div>
          {section === "profile" && (
            <div className="mx-auto max-w-2xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">プロフィール設定</h1>
              <p className="mt-1 text-sm text-zinc-400">表示名・自己紹介・興味のある分野を管理します。</p>

              <form onSubmit={(e) => void handleProfileSubmit(e)} className="mt-8 space-y-8">
                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
                  <label htmlFor="mypage-display-name" className="text-sm font-bold text-zinc-200">
                    表示名
                  </label>
                  <Input
                    id="mypage-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ニックネームや本名など"
                    className="mt-2 border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                    aria-describedby="mypage-display-name-hint"
                  />
                  <p id="mypage-display-name-hint" className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-500">
                    <span className="block">※表示名の変更は30日に1回のみ可能です</span>
                    {showNextChangeDate && nextEligibleAt ? (
                      <span className="block text-zinc-400">
                        次回変更可能日: {formatDateYmdSlashes(nextEligibleAt)}
                      </span>
                    ) : null}
                  </p>
                </div>

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
                  <label htmlFor="mypage-bio" className="text-sm font-bold text-zinc-200">
                    自己紹介
                  </label>
                  <textarea
                    id="mypage-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={5}
                    placeholder="自分の得意なことや経歴、克服したいことなど"
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
                  />
                </div>

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
                  <label htmlFor="mypage-fitness_history" className="text-sm font-bold text-zinc-200">
                    フィットネス歴
                  </label>
                  <textarea
                    id="mypage-fitness_history"
                    value={fitnessHistory}
                    onChange={(e) => setFitnessHistory(e.target.value)}
                    rows={4}
                    placeholder="例：ジム歴3年、週末はランニングなど"
                    className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/80"
                  />
                </div>

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(198,40,40,0.12)]">
                  <p className="text-sm font-bold text-zinc-200">興味のある分野</p>
                  <p className="mt-1 text-xs text-zinc-500">複数選択できます</p>
                  <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {SKILL_CATEGORY_OPTIONS.map((category) => {
                      const id = `mypage-cat-${category}`
                      const checked = selectedCategories.includes(category)
                      return (
                        <li key={category}>
                          <label
                            htmlFor={id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                              checked
                                ? "border-red-500/60 bg-red-950/30"
                                : "border-zinc-700 bg-zinc-950/50 hover:border-zinc-600"
                            }`}
                          >
                            <input
                              id={id}
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(category)}
                              className="h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-950 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0 focus:ring-offset-zinc-950"
                            />
                            <span className="text-sm text-zinc-200">{category}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <Button
                  type="submit"
                  disabled={profileSaving}
                  className="h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-60"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      保存中...
                    </>
                  ) : (
                    "保存する"
                  )}
                </Button>
              </form>
            </div>
          )}

          {section === "listings" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">出品商品管理</h1>
              <p className="mt-1 text-sm text-zinc-400">あなたが出品したスキルの一覧です。</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {listingsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : listingsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{listingsError}</p>
                ) : listings.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    まだ出品したスキルがありません。{" "}
                    <Link href="/create-skill" className="font-medium text-red-400 underline-offset-4 hover:underline">
                      出品する
                    </Link>
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {listings.map((skill) => (
                      <li
                        key={skill.id}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{skill.title}</p>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                skill.is_published === false
                                  ? "bg-zinc-700/70 text-zinc-200"
                                  : "bg-emerald-900/40 text-emerald-300"
                              }`}
                            >
                              {skill.is_published === false ? "非公開" : "公開中"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">
                            {skill.category ?? "未分類"} · {Number(skill.price).toLocaleString("ja-JP")}
                            円
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {skill.is_published === false ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={publishingListingId === skill.id}
                              onClick={() => void handlePublishListing(skill.id)}
                              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              {publishingListingId === skill.id ? (
                                <>
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                                  公開中...
                                </>
                              ) : (
                                "公開する"
                              )}
                            </Button>
                          ) : null}
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="border-zinc-600 bg-zinc-950 text-zinc-100 hover:border-red-500 hover:bg-zinc-900"
                          >
                            <Link href={`/create-skill?edit=${encodeURIComponent(skill.id)}`}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              編集
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "requests" && (
            <div className="mx-auto max-w-4xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">受講リクエスト</h1>
              <p className="mt-1 text-sm text-zinc-400">事前相談の申請内容を確認し、承認または拒否できます。</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                <h2 className="text-sm font-semibold text-zinc-200">受信リクエスト</h2>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={consultationRequestViewFilter === "pending" ? "default" : "outline"}
                    onClick={() => setConsultationRequestViewFilter("pending")}
                    className={
                      consultationRequestViewFilter === "pending"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
                    }
                  >
                    未対応
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={consultationRequestViewFilter === "handled" ? "default" : "outline"}
                    onClick={() => setConsultationRequestViewFilter("handled")}
                    className={
                      consultationRequestViewFilter === "handled"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
                    }
                  >
                    対応済み
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={consultationRequestViewFilter === "all" ? "default" : "outline"}
                    onClick={() => setConsultationRequestViewFilter("all")}
                    className={
                      consultationRequestViewFilter === "all"
                        ? "bg-red-600 text-white hover:bg-red-500"
                        : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
                    }
                  >
                    すべて
                  </Button>
                </div>
                {consultationRequestsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : consultationRequestsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{consultationRequestsError}</p>
                ) : filteredConsultationRequests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {consultationRequestViewFilter === "pending"
                      ? "未対応の受講リクエストはありません。"
                      : consultationRequestViewFilter === "handled"
                        ? "対応済みの受講リクエストはありません。"
                        : "受講リクエストはまだありません。"}
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {filteredConsultationRequests.map((item) => {
                      const busy = consultationActionBusyId === item.id
                      return (
                        <li key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold text-white">{item.skillTitle}</p>
                              <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                                <Link
                                  href={`/profile/${encodeURIComponent(item.buyerId)}`}
                                  className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
                                >
                                  <div
                                    className="h-7 w-7 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${item.buyerAvatarUrl})` }}
                                    role="img"
                                    aria-hidden
                                  />
                                  <span>{item.buyerDisplayName}</span>
                                </Link>
                              </div>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                item.status === "pending"
                                  ? "bg-amber-900/40 text-amber-300"
                                  : item.status === "accepted"
                                    ? "bg-emerald-900/40 text-emerald-300"
                                    : "bg-rose-900/40 text-rose-300"
                              }`}
                            >
                              {item.status === "pending" ? "承認待ち" : item.status === "accepted" ? "承認済み" : "拒否済み"}
                            </span>
                          </div>

                          <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
                            {item.q1Label ? (
                              <p className="text-zinc-300">
                                <span className="font-semibold text-zinc-200">{item.q1Label}:</span> {item.a1Text || "未入力"}
                              </p>
                            ) : null}
                            {item.q2Label ? (
                              <p className="text-zinc-300">
                                <span className="font-semibold text-zinc-200">{item.q2Label}:</span> {item.a2Text || "未入力"}
                              </p>
                            ) : null}
                            {item.q3Label ? (
                              <p className="text-zinc-300">
                                <span className="font-semibold text-zinc-200">{item.q3Label}:</span> {item.a3Text || "未入力"}
                              </p>
                            ) : null}
                            {item.freeLabel ? (
                              <p className="text-zinc-300">
                                <span className="font-semibold text-zinc-200">{item.freeLabel}:</span> {item.freeText || "未入力"}
                              </p>
                            ) : null}
                          </div>

                          {item.status === "pending" ? (
                            <div className="mt-4 space-y-3">
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setRejectConfirmTargetId(null)
                                    setRejectOptionalReason("")
                                    void handleAcceptConsultation(item)
                                  }}
                                  className="h-10 flex-1 bg-emerald-600 text-white hover:bg-emerald-500"
                                >
                                  承認
                                </Button>
                                <Button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    setRejectConfirmTargetId(item.id)
                                    setRejectOptionalReason("")
                                  }}
                                  className="h-10 flex-1 bg-rose-600 text-white hover:bg-rose-500"
                                >
                                  拒否
                                </Button>
                              </div>
                              {rejectConfirmTargetId === item.id ? (
                                <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-300">拒否理由（任意）</p>
                                    <textarea
                                      rows={3}
                                      value={rejectOptionalReason}
                                      onChange={(event) => setRejectOptionalReason(event.target.value)}
                                      placeholder="任意です。未入力でも拒否できます。"
                                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      disabled={busy}
                                      onClick={() => {
                                        setRejectConfirmTargetId(null)
                                        setRejectOptionalReason("")
                                      }}
                                      className="h-9 flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
                                    >
                                      キャンセル
                                    </Button>
                                    <Button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void handleRejectConsultation(item, rejectOptionalReason)}
                                      className="h-9 flex-1 bg-rose-600 text-white hover:bg-rose-500"
                                    >
                                      この内容で拒否する
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                <h2 className="text-sm font-semibold text-zinc-200">送信済みリクエスト</h2>
                <p className="mt-1 text-xs text-zinc-500">自分が送った事前オファーの状況を確認できます。</p>
                {sentConsultationRequestsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : sentConsultationRequestsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{sentConsultationRequestsError}</p>
                ) : sentConsultationRequests.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">送信済みの受講リクエストはありません。</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {sentConsultationRequests.map((item) => (
                      <li key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <Link
                              href={
                                item.transactionId
                                  ? `/chat/${encodeURIComponent(item.transactionId)}`
                                  : `/skills/${encodeURIComponent(String(item.skillId))}`
                              }
                              className="font-semibold text-white underline-offset-4 hover:text-red-300 hover:underline"
                            >
                              {item.skillTitle}
                            </Link>
                            <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                              <Link
                                href={`/profile/${encodeURIComponent(item.sellerId)}`}
                                className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
                              >
                                <div
                                  className="h-7 w-7 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                                  style={{ backgroundImage: `url(${item.sellerAvatarUrl})` }}
                                  role="img"
                                  aria-hidden
                                />
                                <span>{item.sellerDisplayName}</span>
                              </Link>
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.status === "pending"
                                ? "bg-amber-900/40 text-amber-300"
                                : item.status === "accepted"
                                  ? "bg-emerald-900/40 text-emerald-300"
                                  : "bg-rose-900/40 text-rose-300"
                            }`}
                          >
                            {item.status === "pending"
                              ? "未対応"
                              : item.status === "accepted"
                                ? "承認済み"
                                : "拒否済み"}
                          </span>
                        </div>
                        {item.status === "rejected" ? (
                          <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-100">
                            <p className="font-semibold">拒否理由</p>
                            <p className="mt-1 whitespace-pre-wrap text-rose-100/90">
                              {item.rejectionReason || "（理由は入力されていません）"}
                            </p>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "favorites" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">お気に入り</h1>
              <p className="mt-1 text-sm text-zinc-400">保存したスキルの一覧です。</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {favoritesLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : favoritesError ? (
                  <p className="py-8 text-center text-sm text-red-400">{favoritesError}</p>
                ) : favoriteSkills.length === 0 ? (
                  <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
                    まだお気に入り登録されたスキルはありません。
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {favoriteSkills.map((skill) => (
                      <li
                        key={skill.favoriteId}
                        className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 gap-3 sm:items-center">
                          <div
                            className="h-14 w-[5.6rem] shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                            style={{ backgroundImage: `url(${skill.imageUrl})` }}
                            role="img"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/skills/${encodeURIComponent(skill.id)}`}
                              className="font-semibold text-white transition-colors hover:text-red-300"
                            >
                              {skill.title}
                            </Link>
                            <p className="mt-1 text-sm text-zinc-400">
                              {Number(skill.price).toLocaleString("ja-JP")}
                              円
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-zinc-600 bg-zinc-950 text-zinc-100 hover:border-red-500 hover:bg-zinc-900"
                          onClick={() => void handleUnfavorite(skill.favoriteId)}
                          aria-label="お気に入りを解除"
                        >
                          <Heart className="mr-1.5 h-3.5 w-3.5 fill-red-500 text-red-500" aria-hidden />
                          お気に入り解除
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "reviews" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">評価</h1>
              <p className="mt-1 text-sm text-zinc-400">あなたに届いた評価とコメントを確認できます。</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : reviewsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{reviewsError}</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {STAR_LEVELS.map((stars) => {
                        const count = reviewDistribution[stars]
                        const denominator = Math.max(1, profileReviewCount)
                        const percentage = profileReviewCount > 0 ? Math.round((count / denominator) * 100) : 0
                        return (
                          <div key={stars} className="flex items-center gap-3 text-sm">
                            <div className="w-12 shrink-0 text-zinc-300">星{stars}</div>
                            <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-red-500 transition-all"
                                style={{ width: `${percentage}%` }}
                                aria-hidden
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedReviewStars((prev) => (prev === stars ? null : stars))}
                              className={`w-16 shrink-0 text-right transition-colors ${
                                selectedReviewStars === stars
                                  ? "font-semibold text-red-300"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {count}人
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <p className="mt-5 text-sm text-zinc-300">
                      平均：<span className="font-bold text-white">{Number(profileRatingAvg ?? 0).toFixed(1)}</span> (
                      {profileReviewCount}件の評価)
                    </p>

                    <div className="mt-8 border-t border-zinc-800 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">評価コメント</h3>
                        {selectedReviewStars != null ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReviewStars(null)}
                            className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
                          >
                            星{selectedReviewStars}のみ表示中（解除）
                          </button>
                        ) : null}
                      </div>
                      {filteredReviewComments.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-500">コメント付きの評価はまだありません。</p>
                      ) : (
                        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                          {filteredReviewComments.map((reviewComment) => {
                            const displayDate = formatRatingDate(reviewComment.createdAt)
                            return (
                              <article key={reviewComment.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-white">{reviewComment.senderName}</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5" aria-label={`評価 ${reviewComment.rating}`}>
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={`${reviewComment.id}-${star}`}
                                          className={`h-3.5 w-3.5 ${
                                            star <= reviewComment.rating
                                              ? "fill-red-500 text-red-500"
                                              : "fill-transparent text-zinc-600"
                                          }`}
                                          aria-hidden
                                        />
                                      ))}
                                    </div>
                                    {displayDate ? <span className="text-xs text-zinc-500">{displayDate}</span> : null}
                                  </div>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                                  {reviewComment.comment}
                                </p>
                              </article>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {(section === "learning" || section === "teaching") && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">
                {section === "learning" ? "受講中" : "対応中"}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {section === "learning"
                  ? "購入して進行中のスキルです。チャットで講師とやり取りできます。"
                  : "あなたが出品者として対応中の取引です。チャットで受講者とやり取りできます。"}
              </p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : transactionsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{transactionsError}</p>
                ) : transactionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {section === "learning"
                      ? "受講中の取引はありません。"
                      : "対応中の取引はありません。"}
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {transactionItems.map((item) => (
                      <li key={item.transactionId}>
                        <Link
                          href={`/chat/${encodeURIComponent(item.transactionId)}`}
                          className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 transition-colors hover:bg-zinc-800/40 -mx-2 px-2 rounded-xl"
                        >
                          <div
                            className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                            style={{ backgroundImage: `url(${item.peerAvatarUrl})` }}
                            role="img"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white">{item.peerDisplayName}</p>
                            <p className="mt-0.5 truncate text-sm text-zinc-400">{item.skillTitle}</p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-zinc-500">チャットへ</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "transactions" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">取引履歴</h1>
              <p className="mt-1 text-sm text-zinc-400">
                完了した取引と、返金・キャンセル済みの取引です。チャットを開いて内容を確認できます（追加の決済は発生しません）。
              </p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {historyTransactionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    読み込み中...
                  </div>
                ) : historyTransactionsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{historyTransactionsError}</p>
                ) : historyTransactionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">取引履歴はまだありません。</p>
                ) : (
                  <>
                    <ul className="divide-y divide-zinc-800">
                      {paginatedHistoryTransactionItems.map((item) => (
                        <li key={item.transactionId}>
                          <Link
                            href={`/chat/${encodeURIComponent(item.transactionId)}`}
                            className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-4 transition-colors first:pt-0 last:pb-0 hover:bg-zinc-800/40"
                          >
                            <div
                              className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                              style={{ backgroundImage: `url(${item.peerAvatarUrl})` }}
                              role="img"
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-white">{item.peerDisplayName}</p>
                              <p className="mt-0.5 truncate text-sm text-zinc-400">{item.skillTitle}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="max-w-[10rem] text-right text-xs font-medium leading-tight text-zinc-300">
                                {item.statusLabel}
                              </span>
                              <span className="max-w-[13rem] text-right text-xs text-zinc-500">{item.completedAtLabel}</span>
                              <span className="text-xs text-zinc-500">チャットへ</span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-500">
                        {historyTransactionItems.length.toLocaleString("ja-JP")}件中 {historyRangeStart}-
                        {historyRangeEnd}件を表示
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          前へ
                        </Button>
                        <span className="min-w-16 text-center text-xs text-zinc-400">
                          {historyPage} / {historyTotalPages}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={historyPage >= historyTotalPages}
                          onClick={() => setHistoryPage((prev) => Math.min(historyTotalPages, prev + 1))}
                          className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          次へ
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {section === "payout" && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left sm:p-8">
              <h1 className="text-xl font-bold text-white">売上・振込設定</h1>
              {!isStripeSetupComplete ? (
                <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-sm text-zinc-400">未登録です。下のボタンからStripe登録を開始してください。</p>
                  <div className="mt-4">
                    <Button
                      type="button"
                      className="bg-red-600 text-white hover:bg-red-500"
                      disabled={payoutLinkBusy || profileLoading}
                      onClick={() => void handleStripeLinkOpen()}
                    >
                      {payoutLinkBusy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          発行中...
                        </>
                      ) : (
                        "Stripeで講師登録を始める"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-zinc-400">登録済みです。Stripeダッシュボードへ移動できます。</p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      className="bg-red-600 text-white hover:bg-red-500"
                      disabled={payoutLinkBusy || profileLoading}
                      onClick={() => void handleStripeLinkOpen()}
                    >
                      {payoutLinkBusy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          発行中...
                        </>
                      ) : (
                        "Stripeダッシュボードで詳細を確認する"
                      )}
                    </Button>
                  </div>
                </>
              )}

              {isStripeSetupComplete ? (
                <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <h2 className="text-sm font-semibold text-zinc-200">Stripe Connect 残高</h2>
                  {connectBalanceLoading ? (
                    <div className="mt-3 flex items-center text-sm text-zinc-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" aria-hidden />
                      残高を取得中...
                    </div>
                  ) : connectBalanceError ? (
                    <p className="mt-3 text-sm text-red-400">{connectBalanceError}</p>
                  ) : (
                    <div className="mt-3 grid gap-2 text-sm text-zinc-300">
                      <p>
                        売上金（合計残高）: {(connectBalance?.total ?? 0).toLocaleString("ja-JP")}
                        円
                      </p>
                      <p>
                        保留金額（Pending）: {(connectBalance?.pending ?? 0).toLocaleString("ja-JP")}
                        円
                      </p>
                      <p>
                        振込可能残高（Available）: {(connectBalance?.available ?? 0).toLocaleString("ja-JP")}
                        円
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                        売上金は、Stripeの決済処理およびセキュリティ審査を経て、数日後に振込可能残高に反映されます。
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <p className="mt-6 text-xs text-zinc-500">
                ※決済情報や本人確認の管理は、すべて決済代行会社Stripeのシステム上で行われます。当アプリでクレジットカード情報等を保持することはありません。
              </p>
            </div>
          )}

          {section === "account" && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <h1 className="text-xl font-bold text-white">{MENU.find((m) => m.id === section)?.label ?? ""}</h1>
              <p className="mt-3 text-sm text-zinc-500">この機能は準備中です。</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
