"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { Copy, Heart, Loader2, Pencil, ShieldAlert, Star, X } from "lucide-react"
import { Header } from "@/components/header"
import {
  ACCENT_COLOR_OPTIONS,
  resolveStoredAccentColor,
  setAccentColorValue,
} from "@/components/AccessibilityModeSync"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { ThumbnailCropModal } from "@/components/thumbnail-crop-modal"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  AVATARS_STORAGE_BUCKET,
  isStorageBucketNotFoundError,
  removeAvatarObjectAtPublicUrl,
} from "@/lib/avatar-storage"
import {
  canChangeDisplayNameAfterCooldown,
  formatDateYmdSlashes,
  getNextDisplayNameChangeEligibleAt,
  parseProfileDate,
} from "@/lib/display-name-policy"
import {
  coerceEmailNotificationSettingsForSave,
  DEFAULT_EMAIL_NOTIFICATION_SETTINGS,
  EMAIL_NOTIFICATION_TOPIC_ITEMS,
  parseEmailNotificationSettings,
  type EmailNotificationSettings,
  type EmailNotificationTopicKey,
} from "@/lib/email-notification-settings"
import { normalizeProfileCategory } from "@/lib/profile-fields"
import { buildProfilePath, isReservedCustomId, isValidCustomIdFormat, normalizeCustomId } from "@/lib/profile-path"
import { SKILL_CATEGORY_OPTIONS } from "@/lib/skill-categories"
import { resolveSkillThumbnailUrl } from "@/lib/skill-thumbnail"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getBanStatusFromProfile } from "@/lib/ban"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import {
  fetchProfileRatingData,
  type ProfileRatingComment,
  type ProfileRatingDistribution,
} from "@/lib/profile-ratings"
import { formatStripePayoutOperationErrorMessage } from "@/lib/stripe-payout-error-notice"
import { createGeneralNotification } from "@/lib/transaction-notifications"
import { autoCompleteTransactions } from "@/lib/transactions"
import {
  checkAndFinalizeStripeStatus,
  getStripeExpressDashboardUrl,
  getStripeOnboardingUrl,
} from "@/actions/stripe"
import { getLogoutSuccessHref } from "@/components/logout-success-toast"
import { MypageInquirySection } from "./MypageInquirySection"

type MypageSection =
  | "profile"
  | "listings"
  | "requests"
  | "inquiry"
  | "learning"
  | "teaching"
  | "transactions"
  | "favorites"
  | "reviews"
  | "payout"
  | "account"

type MypageMode = "student" | "instructor"
type MenuItem = { id: MypageSection; label: string }
const MYPAGE_MODE_STORAGE_KEY = "mypage_mode_preference"

const STUDENT_PRIMARY_MENU: MenuItem[] = [
  { id: "favorites", label: "お気に入り" },
  { id: "requests", label: "リクエスト" },
  { id: "inquiry", label: "相談中の案件" },
  { id: "learning", label: "進行中の取引（受講中）" },
  { id: "transactions", label: "取引履歴" },
]

const INSTRUCTOR_PRIMARY_MENU: MenuItem[] = [
  { id: "listings", label: "出品管理" },
  { id: "requests", label: "リクエスト" },
  { id: "inquiry", label: "相談" },
  { id: "teaching", label: "進行中の取引（対応中）" },
  { id: "transactions", label: "取引履歴" },
  { id: "payout", label: "売上・振込設定" },
]

const SETTINGS_MENU: MenuItem[] = [
  { id: "profile", label: "プロフィール" },
  { id: "reviews", label: "評価" },
  { id: "account", label: "アカウント設定" },
]

const ALL_MENU: MenuItem[] = [...INSTRUCTOR_PRIMARY_MENU, ...STUDENT_PRIMARY_MENU, ...SETTINGS_MENU]

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
  return ALL_MENU.some((item) => item.id === value)
}

function inferModeFromSection(section: MypageSection): MypageMode {
  const instructorSectionSet = new Set<MypageSection>(["listings", "teaching", "payout"])
  return instructorSectionSet.has(section) ? "instructor" : "student"
}

function resolveModeForSection(section: MypageSection, fallbackMode: MypageMode): MypageMode {
  const instructorOnlySectionSet = new Set<MypageSection>(["listings", "teaching", "payout"])
  const studentOnlySectionSet = new Set<MypageSection>(["favorites", "learning"])
  if (instructorOnlySectionSet.has(section)) {
    return "instructor"
  }
  if (studentOnlySectionSet.has(section)) {
    return "student"
  }
  return fallbackMode
}

/** `/mypage` で tab 未指定時の初期パネル（受講生: お気に入り / 講師: 出品管理） */
function defaultMypageHomeSection(mode: MypageMode): MypageSection {
  return mode === "instructor" ? "listings" : "favorites"
}

type ListedSkill = {
  id: string
  title: string
  category: string | null
  price: number
  created_at: string | null
  is_published: boolean | null
  admin_publish_locked: boolean | null
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
  skills:
    | { id: string; title: string; thumbnail_url: string | null }
    | { id: string; title: string; thumbnail_url: string | null }[]
    | null
}

type TransactionHistoryListRow = TransactionListRow & {
  status: string
  completed_at: string | null
}

type MypageTransactionItem = {
  transactionId: string
  skillId: string
  skillTitle: string
  skillImageUrl: string
  peerDisplayName: string
  peerAvatarUrl: string
  startedAtLabel: string
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
  buyerProfilePath: string
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
  sellerProfilePath: string
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

function revokeBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

function formatTransactionStartedAtLabel(createdAt: string | null): string {
  if (!createdAt) {
    return "取引開始日: -"
  }
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) {
    return "取引開始日: -"
  }
  const text = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
  return `取引開始日: ${text}`
}

export default function MypageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isBannedUser, setIsBannedUser] = useState(false)

  const sectionParam = searchParams.get("tab")
  const modeParam = searchParams.get("mode")
  const modeFromParam = modeParam === "student" || modeParam === "instructor" ? modeParam : null
  const [storedMode] = useState<MypageMode | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    const savedMode = window.localStorage.getItem(MYPAGE_MODE_STORAGE_KEY)
    return savedMode === "student" || savedMode === "instructor" ? savedMode : null
  })
  const section: MypageSection = isMypageSection(sectionParam)
    ? sectionParam
    : defaultMypageHomeSection(modeFromParam ?? storedMode ?? "student")
  const currentMode: MypageMode = modeFromParam ?? resolveModeForSection(section, storedMode ?? inferModeFromSection(section))
  const stripeReturnParam = searchParams.get("stripe")
  const updatedParam = searchParams.get("updated")

  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [savedDisplayName, setSavedDisplayName] = useState("")
  const [customId, setCustomId] = useState("")
  const [savedCustomId, setSavedCustomId] = useState("")
  const [lastNameChange, setLastNameChange] = useState<Date | null>(null)
  const [bio, setBio] = useState("")
  const [fitnessHistory, setFitnessHistory] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [profileRatingAvg, setProfileRatingAvg] = useState<number | null>(null)
  const [profileReviewCount, setProfileReviewCount] = useState(0)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState("")
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false)
  const [avatarCropModalOpen, setAvatarCropModalOpen] = useState(false)
  const [avatarCropSourceUrl, setAvatarCropSourceUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const profileFormRef = useRef<HTMLFormElement>(null)
  const customIdConfirmBypassRef = useRef(false)
  /** 連続する loadProfile の完了順が逆転して古いデータで上書きしないようにする */
  const profileLoadGenerationRef = useRef(0)
  /** 同一ユーザーで一度でもプロフィールを反映済みなら、再取得時に全画面ローダーを出さない */
  const profileHydratedUserIdRef = useRef<string | null>(null)

  const [listings, setListings] = useState<ListedSkill[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsError, setListingsError] = useState<string | null>(null)
  const [listingPublishConfirmId, setListingPublishConfirmId] = useState<string | null>(null)
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
  const [stripeConnectChargesEnabled, setStripeConnectChargesEnabled] = useState(false)
  const [stripeConnectAccountId, setStripeConnectAccountId] = useState("")
  const [payoutLinkBusy, setPayoutLinkBusy] = useState(false)
  const [showStripeOnboardingConfirm, setShowStripeOnboardingConfirm] = useState(false)
  const [connectBalanceLoading, setConnectBalanceLoading] = useState(false)
  const [connectBalanceError, setConnectBalanceError] = useState<string | null>(null)
  const [connectBalance, setConnectBalance] = useState<ConnectBalanceResponse | null>(null)
  const [showAccountLogoutConfirm, setShowAccountLogoutConfirm] = useState(false)
  const [accountLogoutBusy, setAccountLogoutBusy] = useState(false)
  const [showCustomIdConfirm, setShowCustomIdConfirm] = useState(false)
  const [pendingCustomIdForConfirm, setPendingCustomIdForConfirm] = useState("")
  const [accentColorValue, setAccentColorValueState] = useState<string>("#e64a19")
  const [themeReady, setThemeReady] = useState(false)
  const [emailNotificationSettings, setEmailNotificationSettings] = useState<EmailNotificationSettings>(() => ({
    ...DEFAULT_EMAIL_NOTIFICATION_SETTINGS,
  }))
  const [emailNotificationSaving, setEmailNotificationSaving] = useState(false)
  const filteredReviewComments =
    selectedReviewStars == null
      ? reviewComments
      : reviewComments.filter((comment) => comment.rating === selectedReviewStars)

  const handleSectionChange = useCallback(
    (nextSection: MypageSection) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", nextSection)
      params.set("mode", resolveModeForSection(nextSection, currentMode))
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams, currentMode],
  )

  const handleModeChange = useCallback(
    (nextMode: MypageMode) => {
      const params = new URLSearchParams(searchParams.toString())
      const modeMenu = nextMode === "instructor" ? INSTRUCTOR_PRIMARY_MENU : STUDENT_PRIMARY_MENU
      const allowedSections = new Set([...modeMenu.map((item) => item.id), ...SETTINGS_MENU.map((item) => item.id)])
      const nextSection = allowedSections.has(section) ? section : modeMenu[0].id

      params.set("mode", nextMode)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MYPAGE_MODE_STORAGE_KEY, nextMode)
      }
      params.set("tab", nextSection)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams, section],
  )

  const handleCopyProfileUrl = useCallback(async () => {
    if (!userId) {
      setNotice({ variant: "error", message: "プロフィールURLの取得に失敗しました。" })
      return
    }
    if (typeof window === "undefined") {
      return
    }
    const profileUrl = `${window.location.origin}${buildProfilePath(userId, savedCustomId)}`
    try {
      await navigator.clipboard.writeText(profileUrl)
      setNotice({ variant: "success", message: "プロフィールURLをコピーしました。" })
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = profileUrl
      textarea.setAttribute("readonly", "")
      textarea.style.position = "absolute"
      textarea.style.left = "-9999px"
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand("copy")
      document.body.removeChild(textarea)
      if (!copied) {
        setNotice({ variant: "error", message: "コピーに失敗しました。手動でコピーしてください。" })
        return
      }
      setNotice({ variant: "success", message: "プロフィールURLをコピーしました。" })
    }
  }, [savedCustomId, userId])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(MYPAGE_MODE_STORAGE_KEY, currentMode)
  }, [currentMode])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const resolved = resolveStoredAccentColor(window.localStorage.getItem("accent_color_value"))
    setAccentColorValueState(resolved)
    setAccentColorValue(resolved)
  }, [])

  useEffect(() => {
    setThemeReady(true)
  }, [])

  const handleAccentColorChange = (nextColor: string) => {
    setAccentColorValueState(nextColor)
    setAccentColorValue(nextColor)
  }

  const isDarkMode = (theme === "system" ? resolvedTheme : theme) !== "light"
  const handleThemeToggle = () => {
    setTheme(isDarkMode ? "light" : "dark")
  }

  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    )
  }

  const closeAvatarCropModal = () => {
    setAvatarCropModalOpen(false)
    if (avatarCropSourceUrl) {
      URL.revokeObjectURL(avatarCropSourceUrl)
      setAvatarCropSourceUrl(null)
    }
  }

  const handleAvatarCropConfirm = async (blob: Blob) => {
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" })
    setPendingAvatarFile(file)
    setAvatarMarkedForRemoval(false)
    setPendingAvatarPreview((prev) => {
      if (prev) revokeBlobUrl(prev)
      return URL.createObjectURL(blob)
    })
  }

  const handleAvatarFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setNotice(null)
    if (!file) {
      event.target.value = ""
      return
    }
    if (!file.type.startsWith("image/")) {
      setNotice({ variant: "error", message: "画像ファイル（jpg/png/webp等）を選択してください。" })
      event.target.value = ""
      return
    }
    if (avatarCropSourceUrl) {
      URL.revokeObjectURL(avatarCropSourceUrl)
    }
    setAvatarCropSourceUrl(URL.createObjectURL(file))
    setAvatarCropModalOpen(true)
    event.target.value = ""
  }

  const clearAvatarSelection = () => {
    if (pendingAvatarFile || pendingAvatarPreview) {
      setPendingAvatarFile(null)
      setPendingAvatarPreview((prev) => {
        if (prev) revokeBlobUrl(prev)
        return ""
      })
      setAvatarMarkedForRemoval(false)
      return
    }
    if (profileAvatarUrl) {
      setAvatarMarkedForRemoval(true)
    }
  }

  const uploadAvatarToStorage = async (currentUserId: string, file: File): Promise<string> => {
    const extension =
      file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg")
        ? "jpg"
        : (file.name.split(".").pop()?.toLowerCase() ?? "jpg")
    const allowed = ["jpg", "jpeg", "png", "webp", "gif"]
    const ext = allowed.includes(extension) ? extension : "jpg"
    const objectKey = `${currentUserId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from(AVATARS_STORAGE_BUCKET).upload(objectKey, file, {
      upsert: false,
      contentType: file.type || `image/${ext === "jpg" || ext === "jpeg" ? "jpeg" : ext}`,
    })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(objectKey)

    if (!publicUrl) {
      throw new Error("アイコン画像の公開URL取得に失敗しました。")
    }

    return publicUrl
  }

  const profileAvatarPreviewSrc = useMemo(() => {
    if (pendingAvatarPreview) {
      return pendingAvatarPreview
    }
    if (avatarMarkedForRemoval) {
      return resolveProfileAvatarUrl(null, displayName.trim() || "?")
    }
    return resolveProfileAvatarUrl(profileAvatarUrl, displayName.trim() || "?")
  }, [pendingAvatarPreview, avatarMarkedForRemoval, profileAvatarUrl, displayName])

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) {
        revokeBlobUrl(pendingAvatarPreview)
      }
    }
  }, [pendingAvatarPreview])

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
      void getBanStatusFromProfile(supabase, data.user.id).then((banStatus) => {
        if (!mounted) {
          return
        }
        setIsBannedUser(banStatus.isBanned && !banStatus.isAdmin)
      })
    }

    void checkAuth()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  useEffect(() => {
    if (!userId) {
      profileHydratedUserIdRef.current = null
      setProfileLoading(false)
      return
    }
    if (profileHydratedUserIdRef.current !== userId) {
      setProfileLoading(true)
    }
  }, [userId])

  const loadProfile = useCallback(async () => {
    if (!userId) {
      return
    }
    const generation = ++profileLoadGenerationRef.current
    const isStale = () => generation !== profileLoadGenerationRef.current

    if (profileHydratedUserIdRef.current !== userId) {
      setProfileLoading(true)
    }
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, display_name, custom_id, avatar_url, bio, fitness_history, category, last_name_change, rating_avg, review_count, stripe_connect_account_id, is_stripe_registered, stripe_connect_charges_enabled, email_notification_settings",
      )
      .eq("id", userId)
      .maybeSingle()

    if (isStale()) {
      return
    }

    if (error) {
      profileHydratedUserIdRef.current = null
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: "プロフィールの読み込みに失敗しました。" }),
      )
      setProfileLoading(false)
      return
    }

    const row = data as Record<string, unknown> | null
    const nameVal = row?.display_name
    const customIdVal = row?.custom_id
    const bioVal = row?.bio
    const fhVal = row?.fitness_history
    const rawLast = row?.last_name_change
    const ratingAvg = Number(row?.rating_avg)
    const reviewCount = Number(row?.review_count)
    const stripeAccountId = typeof row?.stripe_connect_account_id === "string" ? row.stripe_connect_account_id.trim() : ""
    const nameStr = typeof nameVal === "string" ? nameVal.trim() : ""
    const avatarRaw = row?.avatar_url
    setProfileAvatarUrl(typeof avatarRaw === "string" && avatarRaw.trim().length > 0 ? avatarRaw.trim() : null)
    setDisplayName(nameStr)
    setSavedDisplayName(nameStr)
    const customIdStr = typeof customIdVal === "string" ? customIdVal.trim() : ""
    setCustomId(customIdStr)
    setSavedCustomId(customIdStr)
    setLastNameChange(parseProfileDate(rawLast))
    setBio(typeof bioVal === "string" ? bioVal.trim() : "")
    setFitnessHistory(typeof fhVal === "string" ? fhVal.trim() : "")
    setSelectedCategories(
      normalizeProfileCategory(row?.category).filter((c) => c !== "フィットネス"),
    )
    setProfileRatingAvg(Number.isFinite(ratingAvg) ? ratingAvg : null)
    setProfileReviewCount(Number.isFinite(reviewCount) ? Math.max(0, Math.floor(reviewCount)) : 0)
    setIsStripeRegistered(row?.is_stripe_registered === true)
    setStripeConnectChargesEnabled(row?.stripe_connect_charges_enabled === true)
    setStripeConnectAccountId(stripeAccountId)
    setEmailNotificationSettings(parseEmailNotificationSettings(row?.email_notification_settings))

    setPendingAvatarFile(null)
    setAvatarMarkedForRemoval(false)
    setPendingAvatarPreview((prev) => {
      if (prev) revokeBlobUrl(prev)
      return ""
    })

    if (isStale()) {
      return
    }

    profileHydratedUserIdRef.current = userId
    setProfileLoading(false)
  }, [supabase, userId, isAdmin])

  const persistEmailNotificationSettings = useCallback(
    async (next: EmailNotificationSettings) => {
      if (!userId) {
        return
      }
      const coerced = coerceEmailNotificationSettingsForSave(next)
      setEmailNotificationSettings(coerced)
      setEmailNotificationSaving(true)
      const { error } = await supabase.from("profiles").update({ email_notification_settings: coerced }).eq("id", userId)
      setEmailNotificationSaving(false)
      if (error) {
        setNotice(
          toErrorNotice(error, isAdmin, { unknownErrorMessage: "メール通知設定の保存に失敗しました。" }),
        )
        void loadProfile()
      }
    },
    [userId, supabase, isAdmin, loadProfile],
  )

  const handleEmailNotificationMasterChange = useCallback(
    async (enabled: boolean) => {
      if (emailNotificationSaving || profileLoading || !userId) {
        return
      }
      const next = enabled
        ? { ...DEFAULT_EMAIL_NOTIFICATION_SETTINGS }
        : coerceEmailNotificationSettingsForSave({ ...emailNotificationSettings, master: false })
      await persistEmailNotificationSettings(next)
    },
    [
      emailNotificationSaving,
      profileLoading,
      userId,
      emailNotificationSettings,
      persistEmailNotificationSettings,
    ],
  )

  const handleEmailNotificationTopicChange = useCallback(
    async (key: EmailNotificationTopicKey, enabled: boolean) => {
      if (emailNotificationSaving || profileLoading || !userId || !emailNotificationSettings.master) {
        return
      }
      await persistEmailNotificationSettings({
        ...emailNotificationSettings,
        [key]: enabled,
      })
    },
    [emailNotificationSaving, profileLoading, userId, emailNotificationSettings, persistEmailNotificationSettings],
  )

  const deferProfileFetchForStripeReturn = section === "payout" && stripeReturnParam === "return"

  useEffect(() => {
    if (!userId) {
      return
    }
    /**
     * Stripe オンボーディング復帰（?stripe=return）時は、ここで loadProfile すると
     * checkAndFinalizeStripeStatus より先に古い行が読まれ profileLoading が false になり、
     * 未登録 UI が一瞬出たり最後に勝つ競合が起きる。同期は finalize 専用フローだけが行う。
     */
    if (deferProfileFetchForStripeReturn) {
      return
    }
    void loadProfile()
  }, [userId, loadProfile, deferProfileFetchForStripeReturn])

  useEffect(() => {
    if (!userId || section !== "payout") {
      return
    }
    /** Stripe 復帰の finalize 中は未確定のため残高 API を叩かない（404/エラー表示のちらつき防止） */
    if (stripeReturnParam === "return") {
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
  }, [userId, section, stripeReturnParam, isStripeRegistered, stripeConnectAccountId, stripeConnectChargesEnabled])

  const resolveStripeAccessToken = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return null
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token?.trim() || null
  }, [supabase])

  useEffect(() => {
    if (!userId || section !== "payout" || stripeReturnParam !== "return") {
      return
    }

    let cancelled = false
    const finalizeStripeStatus = async () => {
      let finalizedSuccessfully = false
      try {
        const accessToken = await resolveStripeAccessToken()
        if (!accessToken) {
          if (!cancelled) {
            setNotice({
              variant: "error",
              message: formatStripePayoutOperationErrorMessage(
                "not_authenticated",
                "Stripe連携状態の確認に失敗しました。時間を置いて再度お試しください。",
              ),
            })
          }
          return
        }
        const result = await checkAndFinalizeStripeStatus(accessToken)
        if (!result.ok) {
          if (!cancelled) {
            setNotice({
              variant: "error",
              message: formatStripePayoutOperationErrorMessage(
                result.error,
                "Stripe連携状態の確認に失敗しました。時間を置いて再度お試しください。",
              ),
            })
          }
          return
        }
        finalizedSuccessfully = result.finalized
      } catch (error) {
        if (!cancelled) {
          const raw = error instanceof Error ? error.message : String(error)
          setNotice({
            variant: "error",
            message: formatStripePayoutOperationErrorMessage(
              raw,
              "Stripe連携状態の確認に失敗しました。時間を置いて再度お試しください。",
            ),
          })
        }
        return
      } finally {
        await loadProfile()
      }

      if (cancelled) {
        return
      }
      if (finalizedSuccessfully) {
        setNotice({ variant: "success", message: "Stripe連携が完了しました。" })
      }
      router.replace("/mypage?tab=payout&mode=instructor")
    }

    void finalizeStripeStatus()
    return () => {
      cancelled = true
    }
  }, [userId, section, stripeReturnParam, router, loadProfile, resolveStripeAccessToken])

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
      const accessToken = await resolveStripeAccessToken()
      if (!accessToken) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(
            "not_authenticated",
            "Stripe の画面を開けませんでした。時間を置いて再度お試しください。",
          ),
        })
        return
      }
      const result = await getStripeOnboardingUrl(true, accessToken)
      if (!result.ok) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(
            result.error,
            "Stripe の画面を開けませんでした。時間を置いて再度お試しください。",
          ),
        })
        return
      }
      setShowStripeOnboardingConfirm(false)
      window.location.assign(result.url)
      /* 遷移開始後はページがunloadされるため busy はクリアしない（エラー時のみクリア） */
    } catch (err) {
      setPayoutLinkBusy(false)
      const raw = err instanceof Error ? err.message : String(err)
      setNotice({
        variant: "error",
        message: formatStripePayoutOperationErrorMessage(
          raw,
          "Stripe の画面を開けませんでした。時間を置いて再度お試しください。",
        ),
      })
    }
  }, [resolveStripeAccessToken])

  /** 登録済み: 講師登録確認モーダルを出さずダッシュボードへ */
  const handleStripeDashboardOpen = useCallback(async () => {
    if (payoutLinkBusy || profileLoading) {
      return
    }
    setPayoutLinkBusy(true)
    try {
      const accessToken = await resolveStripeAccessToken()
      if (!accessToken) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(
            "not_authenticated",
            "Stripe ダッシュボードを開けませんでした。時間を置いて再度お試しください。",
          ),
        })
        return
      }
      const result = await getStripeExpressDashboardUrl(accessToken)
      if (!result.ok) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(
            result.error,
            "Stripe ダッシュボードを開けませんでした。時間を置いて再度お試しください。",
          ),
        })
        return
      }
      window.location.assign(result.url)
    } catch (err) {
      setPayoutLinkBusy(false)
      const raw = err instanceof Error ? err.message : String(err)
      setNotice({
        variant: "error",
        message: formatStripePayoutOperationErrorMessage(
          raw,
          "Stripe ダッシュボードを開けませんでした。時間を置いて再度お試しください。",
        ),
      })
    }
  }, [payoutLinkBusy, profileLoading, resolveStripeAccessToken])

  const handleOpenStripeOnboardingConfirm = useCallback(() => {
    if (payoutLinkBusy || profileLoading) {
      return
    }
    setShowStripeOnboardingConfirm(true)
  }, [payoutLinkBusy, profileLoading])

  const handleCloseStripeOnboardingConfirm = useCallback(() => {
    if (payoutLinkBusy) {
      return
    }
    setShowStripeOnboardingConfirm(false)
  }, [payoutLinkBusy])

  const loadListings = useCallback(async () => {
    if (!userId) {
      return
    }
    setListingsLoading(true)
    setListingsError(null)
    const { data, error } = await supabase
      .from("skills")
      .select("id, title, category, price, created_at, is_published, admin_publish_locked")
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

  const executePublishListing = useCallback(async () => {
    const skillId = listingPublishConfirmId
    if (!userId || !skillId || publishingListingId) {
      return
    }
    const targetListing = listings.find((item) => item.id === skillId)
    if (targetListing?.admin_publish_locked) {
      setListingPublishConfirmId(null)
      setNotice({
        variant: "error",
        message: "運営による非公開のため、ご自身で公開に戻すことはできません。",
      })
      return
    }
    setPublishingListingId(skillId)
    const { error } = await supabase
      .from("skills")
      .update({ is_published: true })
      .eq("id", skillId)
      .eq("user_id", userId)
    setPublishingListingId(null)
    setListingPublishConfirmId(null)

    if (error) {
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "スキルの公開に失敗しました。" }))
      return
    }

    setListings((prev) =>
      prev.map((item) => (item.id === skillId ? { ...item, is_published: true } : item)),
    )
    setNotice({ variant: "success", message: "スキルを公開しました。" })
  }, [supabase, userId, publishingListingId, isAdmin, listingPublishConfirmId, listings])

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
        ? await supabase.from("profiles").select("id, display_name, custom_id, avatar_url").in("id", buyerIds)
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
          custom_id: string | null
          avatar_url: string | null
        }
      >()
      for (const row of (buyers ?? []) as Array<{
        id: string
        display_name: string | null
        custom_id: string | null
        avatar_url: string | null
      }>) {
        buyerById.set(row.id, {
          display_name: row.display_name,
          custom_id: row.custom_id,
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
          buyerProfilePath: buildProfilePath(row.buyer_id, buyer?.custom_id ?? null),
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
          ? supabase.from("profiles").select("id, display_name, custom_id, avatar_url").in("id", sellerIds)
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

      const sellerById = new Map<string, { display_name: string | null; custom_id: string | null; avatar_url: string | null }>()
      for (const row of (sellersResult.data ?? []) as Array<{
        id: string
        display_name: string | null
        custom_id: string | null
        avatar_url: string | null
      }>) {
        sellerById.set(row.id, {
          display_name: row.display_name,
          custom_id: row.custom_id,
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
          sellerProfilePath: buildProfilePath(row.seller_id, seller?.custom_id ?? null),
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
          .select("id, created_at, buyer_id, seller_id, skills ( id, title, thumbnail_url )")
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
            skillImageUrl: resolveSkillThumbnailUrl(skill?.thumbnail_url ?? null),
            peerDisplayName: name.length > 0 ? name : "名前未設定",
            peerAvatarUrl: resolveProfileAvatarUrl(prof?.avatar_url, name),
            startedAtLabel: formatTransactionStartedAtLabel(row.created_at),
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
          .select("id, created_at, completed_at, buyer_id, seller_id, status, skills ( id, title, thumbnail_url )")
          .eq(currentMode === "instructor" ? "seller_id" : "buyer_id", userId)
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
        const peerIds = rows.map((r) => (currentMode === "instructor" ? r.buyer_id : r.seller_id))
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
          const peerId = currentMode === "instructor" ? row.buyer_id : row.seller_id
          const prof = profileById.get(peerId)
          const name = prof?.display_name?.trim() ?? ""
          const s = row.skills
          const skill = Array.isArray(s) ? s[0] : s
          items.push({
            transactionId: row.id,
            skillId: skill?.id ?? "",
            skillTitle: skill?.title?.trim() ? skill.title : "スキル",
            skillImageUrl: resolveSkillThumbnailUrl(skill?.thumbnail_url ?? null),
            peerDisplayName: name.length > 0 ? name : "名前未設定",
            peerAvatarUrl: resolveProfileAvatarUrl(prof?.avatar_url, name),
            startedAtLabel: formatTransactionStartedAtLabel(row.created_at),
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
  }, [userId, section, supabase, currentMode])

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
      // 通知失敗は本処理をブロックしない
    }
    void fetch("/api/notifications/event-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "consultation_decision",
        answerId: item.id,
        decision: "accepted",
      }),
    }).catch(() => {
      // メール通知失敗で承認処理を失敗扱いにしない
    })
    await loadConsultationRequests()
    setNotice({ variant: "success", message: "受講リクエストを承認しました。" })
  }

  const handleRejectConsultation = async (item: ConsultationRequestItem, reason: string) => {
    const reasonText = reason.trim()
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
      // 通知失敗は本処理をブロックしない
    }
    void fetch("/api/notifications/event-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "consultation_decision",
        answerId: item.id,
        decision: "rejected",
      }),
    }).catch(() => {
      // メール通知失敗で拒否処理を失敗扱いにしない
    })
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
    const normalizedCustomId = normalizeCustomId(customId)
    const normalizedSavedCustomId = normalizeCustomId(savedCustomId)
    if (
      !customIdConfirmBypassRef.current &&
      normalizedSavedCustomId.length === 0 &&
      normalizedCustomId.length > 0
    ) {
      setPendingCustomIdForConfirm(normalizedCustomId)
      setShowCustomIdConfirm(true)
      return
    }
    customIdConfirmBypassRef.current = false
    if (normalizedSavedCustomId.length > 0 && normalizedCustomId !== normalizedSavedCustomId) {
      setNotice({
        variant: "error",
        message: "カスタムIDは一度設定すると変更できません。",
      })
      return
    }
    if (normalizedCustomId.length > 0) {
      if (!isValidCustomIdFormat(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message:
            "カスタムIDは英小文字で開始し、3〜30文字の英小文字・数字・_・-のみ使用できます。",
        })
        return
      }
      if (isReservedCustomId(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message: "そのカスタムIDは予約語のため利用できません。",
        })
        return
      }
    }
    setProfileSaving(true)

    let uploadedNewUrl: string | null = null
    let avatarSkippedDueToMissingBucket = false
    if (pendingAvatarFile) {
      try {
        uploadedNewUrl = await uploadAvatarToStorage(userId, pendingAvatarFile)
      } catch (uploadErr) {
        if (isStorageBucketNotFoundError(uploadErr)) {
          avatarSkippedDueToMissingBucket = true
          uploadedNewUrl = null
        } else {
          setProfileSaving(false)
          setNotice(
            toErrorNotice(uploadErr, isAdmin, { unknownErrorMessage: "アイコン画像のアップロードに失敗しました。" }),
          )
          return
        }
      }
    }

    const trimmedName = displayName.trim()
    const trimmedSaved = savedDisplayName.trim()
    const nameChangeRequested = trimmedName !== trimmedSaved
    const canChangeName = canChangeDisplayNameAfterCooldown(lastNameChange)

    const avatarExtras: Record<string, unknown> = {}
    if (pendingAvatarFile && uploadedNewUrl) {
      avatarExtras.avatar_url = uploadedNewUrl
    } else if (avatarMarkedForRemoval && profileAvatarUrl) {
      avatarExtras.avatar_url = null
    }

    const sharedFields = {
      bio: bio.trim() || null,
      fitness_history: fitnessHistory.trim() || null,
      category: selectedCategories,
      custom_id: normalizedCustomId || null,
      ...avatarExtras,
    }

    const previousStoredAvatarUrl = profileAvatarUrl

    if (nameChangeRequested && !canChangeName) {
      const { error } = await supabase.from("profiles").update(sharedFields).eq("id", userId)

      setProfileSaving(false)

      if (error) {
        if (uploadedNewUrl) {
          await removeAvatarObjectAtPublicUrl(supabase, userId, uploadedNewUrl)
        }
        if ((error as { code?: string } | null)?.code === "23505") {
          setNotice({ variant: "error", message: "このカスタムIDは既に使用されています。" })
          return
        }
        setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "保存に失敗しました。" }))
        return
      }

      if (
        previousStoredAvatarUrl &&
        ((pendingAvatarFile && uploadedNewUrl) || (avatarMarkedForRemoval && previousStoredAvatarUrl))
      ) {
        await removeAvatarObjectAtPublicUrl(supabase, userId, previousStoredAvatarUrl)
      }

      setDisplayName(savedDisplayName)
      setNotice({
        variant: "error",
        message: [
          "名前の変更は30日に1回のみ可能です。表示名以外の内容を保存しました。",
          avatarSkippedDueToMissingBucket
            ? isAdmin
              ? " アイコン画像は Storage の「avatars」バケットが未作成のため保存できませんでした。"
              : " アイコン画像は保存できませんでした。"
            : "",
        ].join(""),
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
      if (uploadedNewUrl) {
        await removeAvatarObjectAtPublicUrl(supabase, userId, uploadedNewUrl)
      }
      if ((error as { code?: string } | null)?.code === "23505") {
        setNotice({ variant: "error", message: "このカスタムIDは既に使用されています。" })
        return
      }
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: "保存に失敗しました。" }))
      return
    }

    if (
      previousStoredAvatarUrl &&
      ((pendingAvatarFile && uploadedNewUrl) || (avatarMarkedForRemoval && previousStoredAvatarUrl))
    ) {
      await removeAvatarObjectAtPublicUrl(supabase, userId, previousStoredAvatarUrl)
    }

    setNotice({
      variant: "success",
      message: avatarSkippedDueToMissingBucket
        ? isAdmin
          ? "プロフィールを保存しました。アイコン画像は Storage の「avatars」バケットが未設定のためアップロードできませんでした。ダッシュボードでバケットとポリシーを確認してください。"
          : "プロフィールを保存しました。アイコン画像は保存できませんでした。しばらくしてから再度お試しください。"
        : "プロフィールを保存しました。",
    })
    await loadProfile()
    router.refresh()
  }

  const handleAccountLogoutRequest = useCallback(() => {
    setShowAccountLogoutConfirm(true)
  }, [])

  const handleAccountLogoutCancel = useCallback(() => {
    if (accountLogoutBusy) {
      return
    }
    setShowAccountLogoutConfirm(false)
  }, [accountLogoutBusy])

  const handleCustomIdConfirmCancel = useCallback(() => {
    if (profileSaving) {
      return
    }
    customIdConfirmBypassRef.current = false
    setShowCustomIdConfirm(false)
    setPendingCustomIdForConfirm("")
  }, [profileSaving])

  const handleCustomIdConfirmProceed = useCallback(() => {
    customIdConfirmBypassRef.current = true
    setShowCustomIdConfirm(false)
    profileFormRef.current?.requestSubmit()
  }, [])

  const handleAccountLogoutConfirm = useCallback(async () => {
    if (accountLogoutBusy) {
      return
    }
    setAccountLogoutBusy(true)
    const { error } = await supabase.auth.signOut()
    setAccountLogoutBusy(false)
    if (!error) {
      setShowAccountLogoutConfirm(false)
      router.push(getLogoutSuccessHref())
      router.refresh()
      return
    }
    setNotice({ variant: "error", message: "ログアウトに失敗しました。もう一度お試しください。" })
  }, [accountLogoutBusy, supabase, router])

  const canChangeDisplayNameNow = canChangeDisplayNameAfterCooldown(lastNameChange)
  const customIdLocked = savedCustomId.trim().length > 0
  const profilePreviewPath = userId ? buildProfilePath(userId, savedCustomId) : null
  const nextEligibleAt = useMemo(
    () => getNextDisplayNameChangeEligibleAt(lastNameChange),
    [lastNameChange],
  )
  /** Webhook は charges_enabled のみ更新することがあり is_stripe_registered が未更新のままになる。出品判定と揃え charges_enabled も見る */
  const isStripeSetupComplete =
    stripeConnectAccountId.length > 0 && (isStripeRegistered || stripeConnectChargesEnabled)
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

  /** モバイルではナビが長く本文が画面外に落ちないよう、タブ切替後に先頭へスクロール */
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const mq = window.matchMedia("(max-width: 767px)")
    if (!mq.matches) {
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [section])

  const shouldBlockByProfileLoading =
    userId != null &&
    (section === "profile" || section === "payout" || section === "reviews" || section === "account") &&
    profileLoading
  const primaryMenu = useMemo(() => {
    const baseMenu = currentMode === "instructor" ? INSTRUCTOR_PRIMARY_MENU : STUDENT_PRIMARY_MENU
    if (!isBannedUser) {
      return baseMenu
    }
    return baseMenu.filter((item) => item.id !== "listings" && item.id !== "payout")
  }, [currentMode, isBannedUser])

  const accountLabel = SETTINGS_MENU.find((item) => item.id === "account")?.label ?? "アカウント設定"

  useEffect(() => {
    if (!isBannedUser) {
      return
    }
    if (section !== "listings" && section !== "payout") {
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "favorites")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [isBannedUser, pathname, router, searchParams, section])

  if (authLoading || shouldBlockByProfileLoading) {
    return (
      <div className={`flex min-h-[100svh] items-center justify-center md:min-h-screen ${isDarkMode ? "bg-zinc-950 text-zinc-200" : "bg-background text-foreground"}`}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
        読み込み中...
      </div>
    )
  }

  return (
    <div
      className={`min-h-[100svh] mypage-accent md:min-h-screen ${
        isDarkMode ? "bg-zinc-950 text-zinc-50" : "bg-background text-foreground mypage-theme-light"
      }`}
    >
      <ThumbnailCropModal
        open={avatarCropModalOpen}
        imageSrc={avatarCropSourceUrl}
        onClose={closeAvatarCropModal}
        onConfirm={handleAvatarCropConfirm}
        isAdmin={isAdmin}
        aspectRatio={1}
        heading="プロフィールアイコン"
        subheading="枠内が保存される範囲です。ドラッグで位置を、ホイールやピンチで拡大・縮小できます（正方形でトリミングされます）。"
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <Header />

      <div className="mx-auto flex max-w-7xl flex-col md:min-h-[calc(100vh-4rem)] md:flex-row">
        {/* PC のみサイドバー（スマホのメニューはヘッダー右のハンバーガーから） */}
        <nav
          aria-label="マイページメニュー"
          className="hidden md:block md:static md:w-56 md:shrink-0 md:border-r md:border-zinc-800 md:bg-zinc-950 md:pt-6"
        >
          <div className="flex flex-col gap-4 overflow-visible px-4 py-2 md:py-0">
            <div className="flex w-full shrink-0 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1">
              <button
                type="button"
                onClick={() => handleModeChange("student")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  currentMode === "student"
                    ? "bg-red-600 text-white shadow-sm shadow-black/30"
                    : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                受講生として利用
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("instructor")}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  currentMode === "instructor"
                    ? "bg-red-600 text-white shadow-sm shadow-black/30"
                    : "text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                講師として利用
              </button>
            </div>

            <div className="flex gap-1 md:flex-col">
              {primaryMenu.map((item) => {
                const active = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSectionChange(item.id)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200 md:rounded-md md:px-3 md:py-2.5 ${
                      active
                        ? "border-red-500/60 bg-red-950/60 text-white shadow-[inset_3px_0_0_0_var(--accent-color)]"
                        : "border-transparent text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <p className="px-3 pb-2 text-[11px] font-semibold tracking-widest text-zinc-600 dark:text-zinc-500">
                設定
              </p>
              {SETTINGS_MENU.map((item) => {
                const active = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSectionChange(item.id)}
                    className={`mt-1 w-full rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-[border-color,background-color,box-shadow] duration-200 ${
                      active
                        ? "border-red-500/60 bg-red-950/60 text-white shadow-[inset_3px_0_0_0_var(--accent-color)]"
                        : "border-transparent text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

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
          {isAdmin ? (
            <div className="mb-4 md:hidden">
              <Button asChild className="w-full bg-red-600 text-xs font-bold text-white hover:bg-red-500">
                <Link href="/admin">管理者ページへ</Link>
              </Button>
            </div>
          ) : null}
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">プロフィール設定</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    アイコン・表示名・自己紹介・興味のある分野を管理します。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profilePreviewPath ? (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      className="border-zinc-700 bg-zinc-950 text-zinc-100 hover:border-red-400 hover:bg-zinc-900"
                    >
                      <Link href={profilePreviewPath} target="_blank" rel="noreferrer">
                        プレビューを見る
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCopyProfileUrl()}
                    className="border-red-500/45 bg-zinc-950 text-red-100 hover:border-red-400 hover:bg-red-950/35"
                  >
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                    自分のプロフィールURLをコピーする
                  </Button>
                </div>
              </div>

              <form ref={profileFormRef} onSubmit={(e) => void handleProfileSubmit(e)} className="mt-8 space-y-8">
                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
                  <p className="text-sm font-bold text-zinc-200">プロフィール画像</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    プロフィールやチャットなどで表示されるアイコン画像を設定できます（任意）
                  </p>
                  <Input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarFileSelect}
                  />
                  <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
                      {profileAvatarPreviewSrc.startsWith("blob:") ? (
                        <Image
                          src={profileAvatarPreviewSrc}
                          alt="アイコンプレビュー"
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="112px"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- Supabase / ui-avatars の外部 URL
                        <img
                          src={profileAvatarPreviewSrc}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      )}
                      {(pendingAvatarPreview || (profileAvatarUrl && !avatarMarkedForRemoval)) ? (
                        <button
                          type="button"
                          onClick={clearAvatarSelection}
                          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600/80 bg-black/70 text-zinc-100 transition-colors hover:border-red-500 hover:text-red-300"
                          aria-label="プロフィール画像を削除または選択を解除"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-1">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-10 w-full border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500 sm:w-auto sm:self-start"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        画像を選択
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
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

                  <label htmlFor="mypage-custom-id" className="mt-5 block text-sm font-bold text-zinc-200">
                    カスタムID（任意・設定推奨）
                  </label>
                  <Input
                    id="mypage-custom-id"
                    value={customId}
                    onChange={(e) => setCustomId(normalizeCustomId(e.target.value))}
                    placeholder="例: taro_fit"
                    className={`mt-2 border-zinc-700 placeholder:text-zinc-500 ${
                      customIdLocked
                        ? "cursor-not-allowed bg-zinc-800 text-zinc-400 opacity-100"
                        : "bg-zinc-950 text-zinc-100 focus-visible:ring-red-500"
                    }`}
                    aria-describedby="mypage-custom-id-hint"
                    disabled={customIdLocked}
                  />
                  <p id="mypage-custom-id-hint" className="mt-2 text-xs leading-relaxed text-zinc-500">
                    プロフィールURLを見やすくできます（例: 『taro_fit』とした場合、https://gritvib.com/profile/taro_fit のように表示されます）。英小文字で開始し、3〜30文字の英小文字・数字・アンダーバー・ハイフンが使えます。
                    一度設定したカスタムIDは変更できませんのでご注意ください。
                  </p>
                  {customIdLocked ? (
                    <p className="mt-1 text-xs font-semibold text-zinc-400">
                      設定済みのため、カスタムIDは編集できません。
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
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

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
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

                <div className="rounded-2xl border border-red-500/25 bg-zinc-900/80 p-6 shadow-[0_0_40px_rgba(230,74,25,0.12)]">
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
                            {skill.admin_publish_locked ? (
                              <span className="inline-flex rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                                運営により非公開
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">
                            {skill.category ?? "未分類"} · {Number(skill.price).toLocaleString("ja-JP")}
                            円
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {skill.is_published === false && !skill.admin_publish_locked ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={publishingListingId === skill.id}
                              onClick={() => setListingPublishConfirmId(skill.id)}
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

          {section === "inquiry" && userId ? <MypageInquirySection userId={userId} mode={currentMode} /> : null}

          {section === "requests" && (
            <div className="mx-auto max-w-4xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">
                {currentMode === "instructor" ? "受信リクエスト" : "送信済みリクエスト"}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {currentMode === "instructor"
                  ? "受講生から届いたリクエストを確認し、承認または拒否できます。"
                  : "自分が送信したリクエストの進捗を確認できます。"}
              </p>

              {currentMode === "instructor" ? (
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
                                    href={item.buyerProfilePath}
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
              ) : (
                <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
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
                                  href={item.sellerProfilePath}
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
              )}
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
                  <ul className="space-y-4">
                    {transactionItems.map((item) => (
                      <li
                        key={item.transactionId}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-colors hover:border-red-500/40 hover:bg-zinc-900/70"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className="aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                              style={{ backgroundImage: `url(${item.skillImageUrl || item.peerAvatarUrl})` }}
                              role="img"
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-bold text-white md:text-lg">{item.skillTitle}</p>
                              <p className="mt-1 text-sm text-zinc-400">講師: {item.peerDisplayName}</p>
                              <p className="mt-1 text-xs text-zinc-500">{item.startedAtLabel}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">取引ID: {item.transactionId}</p>
                            </div>
                          </div>
                          <Button
                            asChild
                            className="h-10 w-full shrink-0 bg-red-600 text-sm font-semibold text-white hover:bg-red-500 sm:w-auto sm:px-5"
                          >
                            <Link href={`/chat/${encodeURIComponent(item.transactionId)}`}>チャットへ</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "transactions" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">
                取引履歴（{currentMode === "instructor" ? "講師として対応" : "受講生として利用"}）
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {currentMode === "instructor"
                  ? "講師として対応した取引の履歴です。完了・返金・キャンセル済みの案件を確認できます。"
                  : "受講生として利用した取引の履歴です。完了・返金・キャンセル済みの案件を確認できます。"}
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
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {currentMode === "instructor"
                      ? "講師として対応した取引履歴はまだありません。"
                      : "受講生として利用した取引履歴はまだありません。"}
                  </p>
                ) : (
                  <>
                    <ul className="space-y-4">
                      {paginatedHistoryTransactionItems.map((item) => (
                        <li
                          key={item.transactionId}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 transition-colors hover:border-red-500/40 hover:bg-zinc-900/70"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div
                                className="aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                                style={{ backgroundImage: `url(${item.skillImageUrl || item.peerAvatarUrl})` }}
                                role="img"
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-bold text-white md:text-lg">{item.skillTitle}</p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  {currentMode === "instructor" ? "受講生" : "講師"}: {item.peerDisplayName}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">{item.startedAtLabel}</p>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 lg:items-end">
                              <span className="inline-flex w-fit rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-200">
                                {item.statusLabel}
                              </span>
                              <span className="text-xs text-zinc-500">{item.completedAtLabel}</span>
                              <Button
                                asChild
                                className="h-10 w-full bg-red-600 text-sm font-semibold text-white hover:bg-red-500 sm:w-auto sm:px-5"
                              >
                                <Link href={`/chat/${encodeURIComponent(item.transactionId)}`}>チャットへ</Link>
                              </Button>
                            </div>
                          </div>
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
                      onClick={handleOpenStripeOnboardingConfirm}
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
                      onClick={() => void handleStripeDashboardOpen()}
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
            <div className="mx-auto max-w-2xl space-y-8">
              <div>
                <h1 className="text-2xl font-black tracking-wide text-white md:text-3xl">{accountLabel}</h1>
                <p className="mt-1 text-sm text-zinc-400">アカウントの確認やログアウトはこちらから行えます。</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left shadow-[0_0_40px_rgba(0,0,0,0.25)] md:p-8">
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <div
                    className="h-20 w-20 shrink-0 rounded-full border border-zinc-700 bg-zinc-800 bg-cover bg-center ring-2 ring-red-500/25"
                    style={{
                      backgroundImage: `url(${resolveProfileAvatarUrl(profileAvatarUrl, displayName || "ユーザー")})`,
                    }}
                    role="img"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">表示名</p>
                    <p className="mt-1 max-w-full truncate text-xl font-bold text-white">
                      {profileLoading ? "読み込み中..." : displayName || "未設定"}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">プロフィールの編集は「プロフィール」から行えます。</p>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">表示テーマ</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    ライトモード / ダークモードを切り替えられます（初期設定はダークモードです）。
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-200">
                      {!themeReady ? "読み込み中..." : isDarkMode ? "ダークモード" : "ライトモード"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!themeReady ? true : isDarkMode}
                      aria-label="表示テーマを切り替える"
                      disabled={!themeReady}
                      onClick={handleThemeToggle}
                      className={`flex h-8 w-14 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-60 ${
                        !themeReady || isDarkMode
                          ? "bg-red-600 focus-visible:ring-red-500"
                          : "bg-zinc-600 focus-visible:ring-zinc-500"
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow-md transition-[margin] duration-200 ease-out ${
                          !themeReady || isDarkMode ? "ml-auto" : "ml-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">アクセントカラー</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    サイト全体の強調色（ロゴ・主要ボタンなど）を選択できます。
                  </p>
                  <div className="mt-4 max-w-xs">
                    <label htmlFor="account-accent-color" className="sr-only">
                      アクセントカラー
                    </label>
                    <select
                      id="account-accent-color"
                      value={accentColorValue}
                      onChange={(event) => handleAccentColorChange(event.target.value)}
                      className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {ACCENT_COLOR_OPTIONS.map((option) => (
                        <option key={option.id} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">メール通知</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    登録メール宛の通知の受信設定です。初期状態はすべてオンです。オフにした項目はメールを送りません。
                    ヘッダーの通知やマイページのお知らせなど<strong className="font-semibold text-zinc-300">アプリ内通知は、ここがオンでもオフでも常に届きます</strong>
                    。「メール通知」をオフにするとメールはすべて止まり、種類のトグルもオフ表示になります。
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-200">メール通知</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={emailNotificationSettings.master}
                      aria-label="メール通知を受け取る"
                      disabled={profileLoading || emailNotificationSaving}
                      onClick={() => void handleEmailNotificationMasterChange(!emailNotificationSettings.master)}
                      className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-60 ${
                        emailNotificationSettings.master
                          ? "bg-red-600 focus-visible:ring-red-500"
                          : "bg-zinc-600 focus-visible:ring-zinc-500"
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow-md transition-[margin] duration-200 ease-out ${
                          emailNotificationSettings.master ? "ml-auto" : "ml-0"
                        }`}
                      />
                    </button>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {EMAIL_NOTIFICATION_TOPIC_ITEMS.map((item) => {
                      const disabled =
                        profileLoading || emailNotificationSaving || !emailNotificationSettings.master
                      const checked = emailNotificationSettings.master && emailNotificationSettings[item.key]
                      return (
                        <li
                          key={item.key}
                          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
                            disabled ? "border-zinc-800 bg-zinc-950/40 opacity-70" : "border-zinc-700 bg-zinc-950/60"
                          }`}
                        >
                          <div className="min-w-0 pt-0.5">
                            <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                            {item.hint ? (
                              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.hint}</p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={checked}
                            aria-label={`${item.label}のメールを受け取る`}
                            disabled={disabled}
                            onClick={() => void handleEmailNotificationTopicChange(item.key, !checked)}
                            className={`mt-0.5 flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-60 ${
                              checked ? "bg-red-600 focus-visible:ring-red-500" : "bg-zinc-600 focus-visible:ring-zinc-500"
                            }`}
                          >
                            <span
                              className={`block h-6 w-6 rounded-full bg-white shadow-md transition-[margin] duration-200 ease-out ${
                                checked ? "ml-auto" : "ml-0"
                              }`}
                            />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">セッション</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    ログアウトすると、このブラウザでのログイン状態が解除されます。
                  </p>
                  <Button
                    type="button"
                    className="mt-4 h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-500 disabled:opacity-60 sm:w-auto sm:min-w-[12rem] sm:px-8"
                    onClick={handleAccountLogoutRequest}
                    disabled={accountLogoutBusy}
                  >
                    ログアウト
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showStripeOnboardingConfirm ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={handleCloseStripeOnboardingConfirm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-onboarding-confirm-title"
            className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="stripe-onboarding-confirm-title" className="text-lg font-bold text-white">
              Stripe講師登録の確認
            </h2>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-sm font-semibold text-zinc-200">
                スムーズに登録を進めるため、Stripe上にはデフォルトで以下の内容が入力されます
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                <li>国: 日本</li>
                <li>事業形態: 個人事業主</li>
                <li>業種: 教育 &gt; その他</li>
                <li>URL: https://gritvib.com</li>
                <li>説明: フィットネスの知識や技術を共有します。</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-200">
                <ShieldAlert className="h-4 w-4" />
                注意事項
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-200">
                <li>これらの情報は登録後、Stripeダッシュボードから変更可能です。</li>
                <li>口座情報や個人情報はStripeが厳重に管理し、当アプリのデータベースには保存されません。</li>
              </ul>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                onClick={handleCloseStripeOnboardingConfirm}
                disabled={payoutLinkBusy}
              >
                キャンセル
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-500"
                onClick={() => void handleStripeLinkOpen()}
                disabled={payoutLinkBusy}
              >
                {payoutLinkBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Stripeへ進む...
                  </>
                ) : (
                  "内容に同意してStripeへ進む"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {payoutLinkBusy ? (
        <div
          className="fixed inset-0 z-[10002] flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 shrink-0 animate-spin text-red-500" aria-hidden />
          <div className="max-w-md space-y-2">
            <p className="text-base font-bold text-white">Stripe の画面を準備しています</p>
            <p className="text-sm leading-relaxed text-zinc-300">
              しばらくすると Stripe のサイトへ移動します。この画面のままお待ちください。
            </p>
          </div>
        </div>
      ) : null}

      {typeof document !== "undefined" &&
        showCustomIdConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
            role="presentation"
            onClick={handleCustomIdConfirmCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="custom-id-confirm-title"
              className="my-auto w-full max-w-md shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="custom-id-confirm-title" className="text-base font-semibold leading-relaxed text-zinc-100">
                カスタムID設定の確認
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                このIDで設定すると、プロフィールURLは以下になります。
              </p>
              <div className="mt-3 rounded-lg border border-red-500/35 bg-zinc-900 px-3 py-2 font-mono text-sm text-red-200">
                https://gritvib.com/profile/{pendingCustomIdForConfirm}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                カスタムIDは一度設定すると変更できません。この内容で保存しますか？
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={handleCustomIdConfirmCancel}
                  disabled={profileSaving}
                >
                  戻る
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-500"
                  onClick={handleCustomIdConfirmProceed}
                  disabled={profileSaving}
                >
                  このIDで保存する
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        listingPublishConfirmId &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
            role="presentation"
            onClick={() => {
              if (!publishingListingId) {
                setListingPublishConfirmId(null)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="listing-publish-confirm-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2
                id="listing-publish-confirm-title"
                className="text-center text-base font-semibold leading-relaxed text-zinc-100"
              >
                このスキルを公開しますか？
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-400">
                「
                {listings.find((item) => item.id === listingPublishConfirmId)?.title ?? "このスキル"}
                」を一覧に表示する状態で保存されます。
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={() => setListingPublishConfirmId(null)}
                  disabled={Boolean(publishingListingId)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                  onClick={() => void executePublishListing()}
                  disabled={Boolean(publishingListingId)}
                >
                  {publishingListingId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      公開中...
                    </>
                  ) : (
                    "公開する"
                  )}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {typeof document !== "undefined" &&
        showAccountLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/70 p-4 sm:p-6"
            role="presentation"
            onClick={handleAccountLogoutCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-logout-confirm-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="account-logout-confirm-title" className="text-center text-base font-medium leading-relaxed text-zinc-100">
                ログアウトしてもよろしいですか？
              </h2>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={handleAccountLogoutCancel}
                  disabled={accountLogoutBusy}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-500"
                  onClick={() => void handleAccountLogoutConfirm()}
                  disabled={accountLogoutBusy}
                >
                  {accountLogoutBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      処理中...
                    </>
                  ) : (
                    "ログアウト"
                  )}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
