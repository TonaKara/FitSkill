"use client"

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { Copy, Heart, Loader2, Pencil, ShieldAlert, Star, X } from "lucide-react"
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
import { buildStorePath, isReservedCustomId, isValidCustomIdFormat, normalizeCustomId } from "@/lib/profile-path"
import { ProfileInterestCategoryPicker } from "@/components/profile-interest-category-picker"
import { loadProfileInterestCategories } from "@/lib/profile-interest-categories"
import { resolveSkillThumbnailUrl, skillThumbnailContainerAspectStyle } from "@/lib/skill-thumbnail"
import { ProfileAvatar } from "@/components/profile-avatar"
import { getProfileAvatarUrl, PROFILE_AVATAR_CROP_EXPORT_PX } from "@/lib/profile-avatar"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getBanStatusFromProfile } from "@/lib/ban"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import {
  fetchProfileRatingData,
  type ProfileRatingComment,
  type ProfileRatingDistribution,
} from "@/lib/profile-ratings"
import {
  formatStripeOnboardingUrlErrorForUser,
  formatStripePayoutOperationErrorMessage,
} from "@/lib/stripe-payout-error-notice"
import { createGeneralNotification } from "@/lib/transaction-notifications"
import { autoCompleteTransactions } from "@/lib/transactions"
import {
  checkAndFinalizeStripeStatus,
  getStripeExpressDashboardUrl,
  getStripeOnboardingUrl,
} from "@/actions/stripe"
import { navigateAfterLogout } from "@/components/logout-success-toast"
import { MypageInquirySection } from "./MypageInquirySection"
import { MypageTradesHub } from "./MypageTradesHub"
import { parseStoredMypageModePreference, writeMypageModePreference } from "@/lib/mypage-mode-preference"
import {
  parseTradesPanel,
  parseTradesSide,
  resolveTradesContentSection,
  TRADES_HUB_PANEL_CARD,
  TRADES_HUB_PANEL_CARD_BODY,
  TRADES_HUB_PANEL_OUTER,
  type TradesPanel,
  type TradesSide,
} from "@/lib/mypage-trades"
import { cn } from "@/lib/utils"
import {
  buildAccountSectionHref,
  isAccountPath,
  pathnameToMypageSection,
  type MypageSectionKey,
} from "@/lib/store-menu"
import { useLocale, useTranslations, useTranslationsWithFallback } from "@/lib/i18n/useI18n"
import { localeToHtmlLang } from "@/lib/i18n/locales"
import { formatCurrencyPlain, normalizeCurrency } from "@/lib/currency"
import { lookupJaMessage } from "@/lib/i18n/ja-canonical"

type MypageSection =
  | "profile"
  | "listings"
  | "trades"
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
type MenuItem = { id: MypageSection; labelKey: string }

const STUDENT_PRIMARY_MENU: MenuItem[] = [
  { id: "trades", labelKey: "tradesMessages" },
  { id: "favorites", labelKey: "favorites" },
]

const INSTRUCTOR_PRIMARY_MENU: MenuItem[] = [{ id: "trades", labelKey: "tradesMessages" }]

const SETTINGS_MENU: MenuItem[] = [
  { id: "profile", labelKey: "profile" },
  { id: "reviews", labelKey: "reviews" },
  { id: "account", labelKey: "account" },
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

function formatRatingDate(isoDate: string, htmlLang: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat(htmlLang, {
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

/** `/mypage` で tab 未指定時の初期パネル */
function defaultMypageHomeSection(_mode: MypageMode): MypageSection {
  return "trades"
}

type ListedSkill = {
  id: string
  title: string
  category: string | null
  price: number
  /** 行の販売通貨。未指定（古い行）は 'JPY' フォールバック */
  currency?: string | null
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
  /** 行の販売通貨。未指定（古いデータ）は 'JPY' フォールバック */
  currency?: string | null
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
  peerAvatarUrl: string | null
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
  buyerAvatarUrl: string | null
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
  sellerAvatarUrl: string | null
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

type HistoryStatusTranslator = (status: string) => string
type HistoryCompletedAtFormatter = (completedAt: string | null, createdAt: string | null) => string
type TransactionStartedAtFormatter = (createdAt: string | null) => string

function createHistoryStatusLabel(t: (key: string) => string): HistoryStatusTranslator {
  return (status: string) => {
    if (status === "canceled" || status === "refunded") {
      return t("statusCanceledOrRefunded")
    }
    if (status === "completed") {
      return t("statusCompleted")
    }
    return status
  }
}

function createHistoryCompletedAtFormatter(
  t: (key: string, vars?: Record<string, string>) => string,
  htmlLang: string,
): HistoryCompletedAtFormatter {
  return (completedAt: string | null, createdAt: string | null) => {
    const raw = completedAt ?? createdAt
    if (!raw) {
      return t("completedAtPlaceholder")
    }
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) {
      return t("completedAtPlaceholder")
    }
    const text = new Intl.DateTimeFormat(htmlLang, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d)
    return t("completedAtLabel", { date: text })
  }
}

function revokeBlobUrl(url: string) {
  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url)
  }
}

function createTransactionStartedAtFormatter(
  t: (key: string, vars?: Record<string, string>) => string,
  htmlLang: string,
): TransactionStartedAtFormatter {
  return (createdAt: string | null) => {
    if (!createdAt) {
      return t("startedAtPlaceholder")
    }
    const d = new Date(createdAt)
    if (Number.isNaN(d.getTime())) {
      return t("startedAtPlaceholder")
    }
    const text = new Intl.DateTimeFormat(htmlLang, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
    return t("startedAtLabel", { date: text })
  }
}

export default function MypageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const locale = useLocale()
  const htmlLang = useMemo(() => localeToHtmlLang(locale), [locale])
  const tCommon = useTranslations("common")
  const tMenu = useTranslations("mypage.menu")
  const tProfile = useTranslations("mypage.profile")
  const tListings = useTranslations("mypage.listings")
  const tRequests = useTranslations("mypage.requests")
  const tFavoritesNs = useTranslations("mypage.favorites")
  const tReviewsNs = useTranslations("mypage.reviews")
  const tTrades = useTranslations("mypage.trades")
  const tHistory = useTranslations("mypage.history")
  const tPayout = useTranslations("mypage.payout")
  const tStripeConfirm = useTranslations("mypage.stripeConfirm")
  const tPayoutBusy = useTranslations("mypage.payoutBusy")
  const tAccount = useTranslations("mypage.account")
  const tAccentColors = useTranslationsWithFallback("accentColors")
  const tToasts = useTranslations("mypageToasts")
  const tLogoutConfirm = useTranslations("mypage.logoutConfirm")
  const tCustomIdConfirm = useTranslations("mypage.customIdConfirm")
  const formatTradeStartedAtLabel = useMemo(
    () => createTransactionStartedAtFormatter(tTrades, htmlLang),
    [tTrades, htmlLang],
  )
  const formatTradeHistoryCompletedAtLabel = useMemo(
    () => createHistoryCompletedAtFormatter(tTrades, htmlLang),
    [tTrades, htmlLang],
  )
  const historyStatusLabelFn = useMemo(() => createHistoryStatusLabel(tHistory), [tHistory])

  const [authLoading, setAuthLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isBannedUser, setIsBannedUser] = useState(false)

  const accountSectionFromPath = pathnameToMypageSection(pathname)
  const isAccountLayout = accountSectionFromPath !== null || isAccountPath(pathname)
  const sectionParam = searchParams.get("tab")
  const modeParam = searchParams.get("mode")
  const modeFromParam = modeParam === "student" || modeParam === "instructor" ? modeParam : null
  const [storedMode] = useState<MypageMode | null>(() => parseStoredMypageModePreference())
  const section: MypageSection = accountSectionFromPath
    ? accountSectionFromPath
    : isMypageSection(sectionParam)
      ? sectionParam
      : defaultMypageHomeSection(modeFromParam ?? storedMode ?? "student")
  const currentMode: MypageMode = modeFromParam ?? resolveModeForSection(section, storedMode ?? inferModeFromSection(section))
  const tradesSide: TradesSide = parseTradesSide(searchParams.get("side"), currentMode)
  const tradesPanel: TradesPanel = parseTradesPanel(searchParams.get("panel"))
  const activeContentSection: MypageSection =
    section === "trades" ? resolveTradesContentSection(tradesSide, tradesPanel) : section
  const tradeViewAsSeller = section === "trades" ? tradesSide === "seller" : currentMode === "instructor"
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
  /** UI 非表示。既存ユーザーの DB 値を保存時にそのまま維持する */
  const preservedFitnessHistoryRef = useRef<string | null>(null)
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
      if (isAccountLayout) {
        const sectionKey = nextSection as MypageSectionKey
        router.replace(
          buildAccountSectionHref(sectionKey, {
            mode: resolveModeForSection(nextSection, currentMode),
            side:
              nextSection === "trades"
                ? ((searchParams.get("side") as TradesSide | null) ??
                  (currentMode === "instructor" ? "seller" : "buyer"))
                : undefined,
            panel:
              nextSection === "trades"
                ? parseTradesPanel(searchParams.get("panel"))
                : undefined,
          }),
        )
        return
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", nextSection)
      params.set("mode", resolveModeForSection(nextSection, currentMode))
      if (nextSection === "trades") {
        if (!params.get("side")) {
          params.set("side", currentMode === "instructor" ? "seller" : "buyer")
        }
        if (!params.get("panel")) {
          params.set("panel", "active")
        }
      } else {
        params.delete("side")
        params.delete("panel")
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams, currentMode, isAccountLayout],
  )

  const handleTradesHubChange = useCallback(
    (next: { side?: TradesSide; panel?: TradesPanel }) => {
      const side =
        next.side ??
        parseTradesSide(searchParams.get("side"), currentMode)
      const panel = next.panel ?? parseTradesPanel(searchParams.get("panel"))
      if (isAccountLayout) {
        router.replace(
          buildAccountSectionHref("trades", {
            mode: currentMode,
            side,
            panel,
          }),
        )
        return
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", "trades")
      params.set("mode", currentMode)
      params.set("side", side)
      params.set("panel", panel)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [router, pathname, searchParams, currentMode, isAccountLayout],
  )

  const handleModeChange = useCallback(
    (nextMode: MypageMode) => {
      writeMypageModePreference(nextMode)
      if (isAccountLayout) {
        if (section === "trades") {
          router.replace(
            buildAccountSectionHref("trades", {
              mode: nextMode,
              side: nextMode === "instructor" ? "seller" : "buyer",
              panel: parseTradesPanel(searchParams.get("panel")),
            }),
          )
        }
        return
      }
      const params = new URLSearchParams(searchParams.toString())
      const modeMenu = nextMode === "instructor" ? INSTRUCTOR_PRIMARY_MENU : STUDENT_PRIMARY_MENU
      const allowedSections = new Set([...modeMenu.map((item) => item.id), ...SETTINGS_MENU.map((item) => item.id)])
      const nextSection = allowedSections.has(section) ? section : modeMenu[0].id

      params.set("mode", nextMode)
      params.set("tab", nextSection)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams, section, isAccountLayout],
  )

  const handleCopyStoreUrl = useCallback(async () => {
    if (!userId) {
      setNotice({ variant: "error", message: tToasts("storeUrlFetchFailed") })
      return
    }
    if (typeof window === "undefined") {
      return
    }
    const profileUrl = `${window.location.origin}${buildStorePath(userId, savedCustomId)}`
    try {
      await navigator.clipboard.writeText(profileUrl)
      setNotice({ variant: "success", message: tToasts("storeUrlCopied") })
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
        setNotice({ variant: "error", message: tToasts("copyFailedManual") })
        return
      }
      setNotice({ variant: "success", message: tToasts("storeUrlCopied") })
    }
  }, [savedCustomId, userId])

  useEffect(() => {
    writeMypageModePreference(currentMode)
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

  const isDarkMode = (theme ?? resolvedTheme) === "dark"
  const handleThemeToggle = () => {
    setTheme(isDarkMode ? "light" : "dark")
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
      setNotice({ variant: "error", message: tToasts("imageFileRequired") })
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
      throw new Error(tToasts("avatarPublicUrlFailed"))
    }

    return publicUrl
  }

  const profileAvatarPreviewUrl = useMemo(() => {
    if (pendingAvatarPreview) {
      return pendingAvatarPreview
    }
    if (avatarMarkedForRemoval) {
      return null
    }
    return getProfileAvatarUrl(profileAvatarUrl)
  }, [pendingAvatarPreview, avatarMarkedForRemoval, profileAvatarUrl])

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
        toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("profileLoadFailed") }),
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
    preservedFitnessHistoryRef.current =
      typeof fhVal === "string" && fhVal.trim().length > 0 ? fhVal.trim() : null
    setSelectedCategories(loadProfileInterestCategories(row?.category))
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
          toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("emailPrefsSaveFailed") }),
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
    /** Stripe 復帰の finalize 中は未確定のため残高表示も止める（ちらつき防止） */
    if (stripeReturnParam === "return") {
      return
    }
    /**
     * Stripe Connect 残高 API (`/api/stripe/connect-balance`) は現在未実装。
     * fetch すると 500 がコンソールに出続けるだけなので、UI 上は「未取得」のまま
     * 描画させ、ネットワーク呼び出しは行わない。
     * 将来 route が復活したら下の処理を `await fetch(...)` に戻す。
     */
    setConnectBalance(null)
    setConnectBalanceError(null)
    setConnectBalanceLoading(false)
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
      const stripeStatusFallback = tToasts("stripeStatusCheckFailed")
      try {
        const accessToken = await resolveStripeAccessToken()
        if (!accessToken) {
          if (!cancelled) {
            setNotice({
              variant: "error",
              message: formatStripePayoutOperationErrorMessage(
                "not_authenticated",
                stripeStatusFallback,
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
                stripeStatusFallback,
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
            message: formatStripePayoutOperationErrorMessage(raw, stripeStatusFallback),
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
        setNotice({ variant: "success", message: tToasts("stripeLinked") })
      }
      router.replace(buildAccountSectionHref("payout", { mode: "instructor" }))
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
    setNotice({ variant: "success", message: tToasts("updated") })
    const params = new URLSearchParams(searchParams.toString())
    params.delete("updated")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [updatedParam, searchParams, router, pathname])

  const handleStripeLinkOpen = useCallback(async () => {
    const onboardingFallback = tToasts("stripeOnboardingOpenFailed")
    setPayoutLinkBusy(true)
    try {
      const accessToken = await resolveStripeAccessToken()
      if (!accessToken) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripeOnboardingUrlErrorForUser(
            "not_authenticated",
            onboardingFallback,
          ),
        })
        return
      }
      const result = await getStripeOnboardingUrl(true, accessToken)
      if (!result.ok) {
        setPayoutLinkBusy(false)
        console.error("[stripe][browser] getStripeOnboardingUrl failed", {
          error: result.error,
          note: "Server Action の console.error はブラウザではなくホスト（Vercel の Function Logs / ローカルはターミナル）に出力されます。",
        })
        setNotice({
          variant: "error",
          message: formatStripeOnboardingUrlErrorForUser(result.error, onboardingFallback),
        })
        return
      }
      setShowStripeOnboardingConfirm(false)
      window.location.assign(result.url)
      /* 遷移開始後はページがunloadされるため busy はクリアしない（エラー時のみクリア） */
    } catch (err) {
      setPayoutLinkBusy(false)
      const raw = err instanceof Error ? err.message : String(err)
      console.error("[stripe][browser] getStripeOnboardingUrl threw", {
        message: raw,
        err,
        note: "Server Action の console.error はホストのサーバーログに出力されます。",
      })
      setNotice({
        variant: "error",
        message: formatStripeOnboardingUrlErrorForUser(raw, onboardingFallback),
      })
    }
  }, [resolveStripeAccessToken, tToasts])

  /** 登録済み: 講師登録確認モーダルを出さずダッシュボードへ */
  const handleStripeDashboardOpen = useCallback(async () => {
    if (payoutLinkBusy || profileLoading) {
      return
    }
    const dashboardFallback = tToasts("stripeDashboardOpenFailed")
    setPayoutLinkBusy(true)
    try {
      const accessToken = await resolveStripeAccessToken()
      if (!accessToken) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(
            "not_authenticated",
            dashboardFallback,
          ),
        })
        return
      }
      const result = await getStripeExpressDashboardUrl(accessToken)
      if (!result.ok) {
        setPayoutLinkBusy(false)
        setNotice({
          variant: "error",
          message: formatStripePayoutOperationErrorMessage(result.error, dashboardFallback),
        })
        return
      }
      window.location.assign(result.url)
    } catch (err) {
      setPayoutLinkBusy(false)
      const raw = err instanceof Error ? err.message : String(err)
      setNotice({
        variant: "error",
        message: formatStripePayoutOperationErrorMessage(raw, dashboardFallback),
      })
    }
  }, [payoutLinkBusy, profileLoading, resolveStripeAccessToken, tToasts])

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
      .select("id, title, category, price, currency, created_at, is_published, admin_publish_locked")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      setListings([])
      setListingsError(tToasts("listingsFetchFailed"))
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
        message: tToasts("adminLockedHide"),
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
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("skillPublishFailed") }))
      return
    }

    setListings((prev) =>
      prev.map((item) => (item.id === skillId ? { ...item, is_published: true } : item)),
    )
    setNotice({ variant: "success", message: tToasts("skillPublished") })
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
        setConsultationRequestsError(tToasts("consultationFetchFailed"))
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
        setConsultationRequestsError(tToasts("consultationFetchFailed"))
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
        setConsultationRequestsError(tToasts("consultationFetchFailed"))
        return
      }

      const skillTitleById = new Map<number, string>()
      for (const row of skillRows) {
        const n = Number(row.id)
        if (!Number.isFinite(n)) {
          continue
        }
        skillTitleById.set(Math.trunc(n), row.title?.trim() || tToasts("skillFallback"))
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
        const buyerName = buyer?.display_name?.trim() || tToasts("nameUnset")
        return {
          id: row.id,
          skillId: row.skill_id,
          skillTitle: skillTitleById.get(row.skill_id) ?? tToasts("skillFallback"),
          buyerId: row.buyer_id,
          sellerId: row.seller_id,
          buyerDisplayName: buyerName,
          buyerAvatarUrl: buyer?.avatar_url ?? null,
          buyerProfilePath: buildStorePath(row.buyer_id, buyer?.custom_id ?? null),
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
          setSentConsultationRequestsError(tToasts("sentRequestsFetchFailed"))
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
        setSentConsultationRequestsError(tToasts("sentRequestsFetchFailed"))
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
        setSentConsultationRequestsError(tToasts("sentRequestsFetchFailed"))
        return
      }

      const skillTitleById = new Map<number, string>()
      for (const row of (skillsResult.data ?? []) as Array<{ id: number | string; title: string | null }>) {
        const n = Number(row.id)
        if (!Number.isFinite(n)) {
          continue
        }
        skillTitleById.set(Math.trunc(n), row.title?.trim() || tToasts("skillFallback"))
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
        const sellerName = seller?.display_name?.trim() || tToasts("instructorFallback")
        const dbReason = row.rejection_reason?.trim() || ""
        const fallbackReason = rejectionReasonBySkillId.get(row.skill_id) || ""
        const transactionId = transactionIdBySkillSeller.get(`${row.skill_id}:${row.seller_id}`) ?? null
        return {
          id: row.id,
          skillId: row.skill_id,
          skillTitle: skillTitleById.get(row.skill_id) ?? tToasts("skillFallback"),
          sellerId: row.seller_id,
          sellerDisplayName: sellerName,
          sellerAvatarUrl: seller?.avatar_url ?? null,
          sellerProfilePath: buildStorePath(row.seller_id, seller?.custom_id ?? null),
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
    if (userId && activeContentSection === "requests") {
      void loadConsultationRequests()
      void loadSentConsultationRequests()
    }
  }, [userId, activeContentSection, loadConsultationRequests, loadSentConsultationRequests])

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
      currency,
      thumbnail_url
    )
  `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      setFavoriteSkills([])
      setFavoritesError(tToasts("favoritesFetchFailed"))
      setFavoritesLoading(false)
      return
    }

    type SkillEmbed = {
      id: string
      title: string
      price: number
      currency?: string | null
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
        currency: skill.currency,
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
        setReviewsError(tToasts("reviewsFetchFailed"))
        setReviewsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [userId, section, supabase])

  useEffect(() => {
    if (!userId || (activeContentSection !== "learning" && activeContentSection !== "teaching")) {
      return
    }

    let cancelled = false

    const loadTransactionsForTab = async () => {
      setTransactionsLoading(true)
      setTransactionsError(null)

      try {
        const isLearning = activeContentSection === "learning"
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
          setTransactionsError(tToasts("transactionsFetchFailed"))
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
          setTransactionsError(tToasts("peerProfileFetchFailed"))
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
            skillTitle: skill?.title?.trim() ? skill.title : tToasts("skillFallback"),
            skillImageUrl: resolveSkillThumbnailUrl(skill?.thumbnail_url ?? null),
            peerDisplayName: name.length > 0 ? name : tToasts("nameUnset"),
            peerAvatarUrl: prof?.avatar_url ?? null,
            startedAtLabel: formatTradeStartedAtLabel(row.created_at),
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
  }, [userId, activeContentSection, supabase, formatTradeStartedAtLabel])

  useEffect(() => {
    if (!userId || activeContentSection !== "transactions") {
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
          .eq(tradeViewAsSeller ? "seller_id" : "buyer_id", userId)
          .in("status", ["completed", "canceled", "refunded"])
          .order("completed_at", { ascending: false })
          .order("created_at", { ascending: false })

        if (cancelled) {
          return
        }

        if (txError) {
          setHistoryTransactionItems([])
          setHistoryTransactionsError(tToasts("transactionsHistoryFetchFailed"))
          return
        }

        const rows = (txRows ?? []) as TransactionHistoryListRow[]
        const peerIds = rows.map((r) => (tradeViewAsSeller ? r.buyer_id : r.seller_id))
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
          setHistoryTransactionsError(tToasts("peerProfileFetchFailed"))
          return
        }

        type ProfileLite = { id: string; display_name: string | null; avatar_url: string | null }
        const profileById = new Map<string, ProfileLite>(
          (profileRows ?? []).map((p: ProfileLite) => [p.id, p]),
        )

        const items: MypageHistoryTransactionItem[] = []
        for (const row of rows) {
          const peerId = tradeViewAsSeller ? row.buyer_id : row.seller_id
          const prof = profileById.get(peerId)
          const name = prof?.display_name?.trim() ?? ""
          const s = row.skills
          const skill = Array.isArray(s) ? s[0] : s
          items.push({
            transactionId: row.id,
            skillId: skill?.id ?? "",
            skillTitle: skill?.title?.trim() ? skill.title : tToasts("skillFallback"),
            skillImageUrl: resolveSkillThumbnailUrl(skill?.thumbnail_url ?? null),
            peerDisplayName: name.length > 0 ? name : tToasts("nameUnset"),
            peerAvatarUrl: prof?.avatar_url ?? null,
            startedAtLabel: formatTradeStartedAtLabel(row.created_at),
            statusLabel: historyStatusLabelFn(row.status),
            completedAtLabel: formatTradeHistoryCompletedAtLabel(row.completed_at, row.created_at),
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
  }, [
    userId,
    activeContentSection,
    supabase,
    tradeViewAsSeller,
    formatTradeStartedAtLabel,
    historyStatusLabelFn,
    formatTradeHistoryCompletedAtLabel,
  ])

  const handleUnfavorite = async (favoriteId: string) => {
    if (!userId) {
      return
    }
    setFavoriteSkills((prev) => prev.filter((f) => f.favoriteId !== favoriteId))

    const { error } = await supabase.from("favorites").delete().eq("id", favoriteId).eq("user_id", userId)

    if (error) {
      setNotice(
        toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("favoritesRemoveFailed") }),
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
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("consultationApproveFailed") }))
      return
    }
    const { error: notifError } = await createGeneralNotification(supabase, {
      recipient_id: item.buyerId,
      sender_id: item.sellerId,
      type: "consultation_accepted",
      title: item.skillTitle,
      reason: `skill_id:${item.skillId}`,
      // DB には常に JA 正規形を保存。表示時翻訳で受信者ロケールに応じて差し替える。
      content: lookupJaMessage("mypageToasts.consultationApprovedSystemContent"),
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
    setNotice({ variant: "success", message: tToasts("consultationApproved") })
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
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("consultationRejectFailed") }))
      return
    }
    const { error: notifError } = await createGeneralNotification(supabase, {
      recipient_id: item.buyerId,
      sender_id: item.sellerId,
      type: "consultation_rejected",
      title: item.skillTitle,
      reason: `skill_id:${item.skillId}`,
      // DB には常に JA 正規形を保存。理由文字列は admin 入力扱いで翻訳しない。
      content:
        reasonText.length > 0
          ? `事前オファーが見送られました。理由: ${reasonText}`
          : lookupJaMessage("mypageToasts.consultationDeclinedNoReason"),
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
    setNotice({ variant: "success", message: tToasts("consultationRejected") })
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
        message: tToasts("customIdLocked"),
      })
      return
    }
    if (normalizedCustomId.length > 0) {
      if (!isValidCustomIdFormat(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message:
            tToasts("customIdValidation"),
        })
        return
      }
      if (isReservedCustomId(normalizedCustomId)) {
        setNotice({
          variant: "error",
          message: tToasts("customIdReserved"),
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
            toErrorNotice(uploadErr, isAdmin, { unknownErrorMessage: tToasts("avatarUploadFailed") }),
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
      fitness_history: preservedFitnessHistoryRef.current,
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
          setNotice({ variant: "error", message: tToasts("customIdTaken") })
          return
        }
        setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("saveFailed") }))
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
          tToasts("displayNameLockedSaved"),
          avatarSkippedDueToMissingBucket
            ? isAdmin
              ? tToasts("avatarSavedAdminPending")
              : tToasts("avatarSaveFailedSuffix")
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
        setNotice({ variant: "error", message: tToasts("customIdTaken") })
        return
      }
      setNotice(toErrorNotice(error, isAdmin, { unknownErrorMessage: tToasts("saveFailed") }))
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
          ? tToasts("profileSavedAvatarPending")
          : tToasts("profileSavedAvatarFailed")
        : tToasts("profileSaved"),
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
    if (!error) {
      navigateAfterLogout()
      return
    }
    setAccountLogoutBusy(false)
    setNotice({ variant: "error", message: tToasts("logoutFailed") })
  }, [accountLogoutBusy, supabase])

  const canChangeDisplayNameNow = canChangeDisplayNameAfterCooldown(lastNameChange)
  const customIdLocked = savedCustomId.trim().length > 0
  const profilePreviewPath = userId ? buildStorePath(userId, savedCustomId) : null
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
    if (activeContentSection === "transactions") {
      setHistoryPage(1)
    }
  }, [activeContentSection])

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
  }, [section, activeContentSection])

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

  const accountLabel = tMenu("account")

  useEffect(() => {
    if (!isBannedUser) {
      return
    }
    if (section !== "listings" && section !== "payout") {
      return
    }
    router.replace(
      buildAccountSectionHref("trades", { side: "buyer", panel: "active", mode: "student" }),
    )
  }, [isBannedUser, router, section])

  if (authLoading || shouldBlockByProfileLoading) {
    return (
      <div className={`flex min-h-[100svh] items-center justify-center md:min-h-screen ${isDarkMode ? "bg-zinc-950 text-zinc-200" : "bg-background text-foreground"}`}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
        {tCommon("loading")}
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
        cropShape="avatar"
        outputPixelSize={{ width: PROFILE_AVATAR_CROP_EXPORT_PX, height: PROFILE_AVATAR_CROP_EXPORT_PX }}
        heading={tProfile("cropHeading")}
        subheading={tProfile("cropSubheading")}
      />
      {notice && <NotificationToast notice={notice} onClose={() => setNotice(null)} />}
      <div
        className={
          isAccountLayout
            ? "w-full"
            : "mx-auto flex max-w-7xl flex-col md:min-h-[calc(100vh-4rem)] md:flex-row"
        }
      >
        {!isAccountLayout ? (
        <nav
          aria-label={tMenu("menuAria")}
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
                {tMenu("studentMode")}
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
                {tMenu("instructorMode")}
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
                    {tMenu(item.labelKey)}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <p className="px-3 pb-2 text-[11px] font-semibold tracking-widest text-zinc-600 dark:text-zinc-500">
                {tMenu("settingsHeading")}
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
                    {tMenu(item.labelKey)}
                  </button>
                )
              })}
            </div>

            {isAdmin ? (
              <Button
                asChild
                className="mt-2 shrink-0 bg-red-600 text-xs font-bold text-white hover:bg-red-500 md:w-full"
              >
                <Link href="/admin">{tMenu("adminPage")}</Link>
              </Button>
            ) : null}
          </div>
        </nav>
        ) : null}

        <main className="flex-1 px-4 pb-16 pt-6 md:px-8 md:pt-8">
          {isAdmin ? (
            <div className="mb-4 md:hidden">
              <Button asChild className="w-full bg-red-600 text-xs font-bold text-white hover:bg-red-500">
                <Link href="/admin">{tMenu("adminPage")}</Link>
              </Button>
            </div>
          ) : null}
          {isAccountLayout ? null : (
            <div className="mb-4 flex justify-end">
              <Button
                asChild
                variant="outline"
                className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
              >
                <Link href="/">{tMenu("toMyStore")}</Link>
              </Button>
            </div>
          )}
          {section === "profile" && (
            <div className="mx-auto max-w-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tProfile("title")}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tProfile("subtitle")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profilePreviewPath ? (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
                    >
                      <Link href={profilePreviewPath} target="_blank" rel="noreferrer">
                        {tProfile("previewLink")}
                      </Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCopyStoreUrl()}
                    className="border-primary/45 bg-accent text-primary-readable hover:border-primary hover:bg-primary/15"
                  >
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                    {tProfile("copyStoreUrl")}
                  </Button>
                </div>
              </div>

              <form ref={profileFormRef} onSubmit={(e) => void handleProfileSubmit(e)} className="mt-8 space-y-8">
                <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-900/80">
                  <p className="text-sm font-bold text-foreground">{tProfile("imageHeading")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tProfile("imageHint")}
                  </p>
                  <Input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleAvatarFileSelect}
                  />
                  <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                    <div className="relative h-28 w-28 shrink-0">
                      <ProfileAvatar
                        src={profileAvatarPreviewUrl}
                        alt={tProfile("imagePreviewAlt")}
                        className="h-28 w-28 border border-border"
                        sizes="112px"
                      />
                      {(pendingAvatarPreview || (profileAvatarUrl && !avatarMarkedForRemoval)) ? (
                        <button
                          type="button"
                          onClick={clearAvatarSelection}
                          className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:border-primary hover:text-primary"
                          aria-label={tProfile("imageRemoveAria")}
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
                        {tProfile("imageSelect")}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-900/80">
                  <label htmlFor="mypage-display-name" className="text-sm font-bold text-foreground">
                    {tProfile("displayNameLabel")}
                  </label>
                  <Input
                    id="mypage-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={tProfile("displayNamePlaceholder")}
                    className="mt-2 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                    aria-describedby="mypage-display-name-hint"
                  />
                  <p id="mypage-display-name-hint" className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                    <span className="block">{tProfile("displayNameNote")}</span>
                    {showNextChangeDate && nextEligibleAt ? (
                      <span className="block text-muted-foreground">
                        {tProfile("displayNameNextChangeable", { date: formatDateYmdSlashes(nextEligibleAt) })}
                      </span>
                    ) : null}
                  </p>

                  <label htmlFor="mypage-custom-id" className="mt-5 block text-sm font-bold text-foreground">
                    {tProfile("customIdLabel")}
                  </label>
                  <Input
                    id="mypage-custom-id"
                    value={customId}
                    onChange={(e) => setCustomId(normalizeCustomId(e.target.value))}
                    placeholder={tProfile("customIdPlaceholder")}
                    className={`mt-2 border-input placeholder:text-muted-foreground ${
                      customIdLocked
                        ? "cursor-not-allowed bg-muted text-muted-foreground opacity-100"
                        : "bg-background text-foreground focus-visible:ring-primary"
                    }`}
                    aria-describedby="mypage-custom-id-hint"
                    disabled={customIdLocked}
                  />
                  <p id="mypage-custom-id-hint" className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {tProfile("customIdHint")}
                  </p>
                  {customIdLocked ? (
                    <p className="mt-1 text-xs font-semibold text-zinc-400">
                      {tProfile("customIdLocked")}
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-900/80">
                  <label htmlFor="mypage-bio" className="text-sm font-bold text-foreground">
                    {tProfile("bioLabel")}
                  </label>
                  <textarea
                    id="mypage-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={5}
                    placeholder={tProfile("bioPlaceholder")}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-primary/25 bg-accent p-6 shadow-sm dark:border-red-500/25 dark:bg-zinc-900/80">
                  <p className="text-sm font-bold text-foreground">{tProfile("interestsLabel")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tProfile("interestsHint")}</p>
                  <div className="mt-4">
                    <ProfileInterestCategoryPicker
                      selectedCategories={selectedCategories}
                      onChange={setSelectedCategories}
                      idPrefix="mypage-cat"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={profileSaving}
                  className="h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-all hover:bg-red-500 disabled:opacity-60"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {tProfile("submitting")}
                    </>
                  ) : (
                    tProfile("submit")
                  )}
                </Button>
              </form>
            </div>
          )}

          {section === "listings" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tListings("title")}</h1>
              <p className="mt-1 text-sm text-zinc-400">{tListings("subtitle")}</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {listingsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    {tCommon("loading")}
                  </div>
                ) : listingsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{listingsError}</p>
                ) : listings.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {tListings("empty")}{" "}
                    <Link href="/create-skill" className="font-medium text-red-400 underline-offset-4 hover:underline">
                      {tListings("emptyLink")}
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
                              {skill.is_published === false ? tListings("statusPrivate") : tListings("statusPublic")}
                            </span>
                            {skill.admin_publish_locked ? (
                              <span className="inline-flex rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                                {tListings("statusAdminLocked")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-zinc-400">
                            {skill.category ?? tListings("uncategorized")} ·{" "}
                            {formatCurrencyPlain(Number(skill.price), normalizeCurrency(skill.currency))}
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
                                  {tListings("publishing")}
                                </>
                              ) : (
                                tListings("publish")
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
                              {tListings("edit")}
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

          {section === "trades" ? (
            <MypageTradesHub
              mode={currentMode}
              side={tradesSide}
              panel={tradesPanel}
              onSideChange={(side) => handleTradesHubChange({ side })}
              onPanelChange={(panel) => handleTradesHubChange({ panel })}
            />
          ) : null}

          {activeContentSection === "inquiry" && userId ? (
            <MypageInquirySection
              userId={userId}
              mode={section === "trades" ? (tradesSide === "seller" ? "instructor" : "student") : currentMode}
            />
          ) : null}

          {activeContentSection === "requests" && (
            <div className={section === "trades" ? TRADES_HUB_PANEL_OUTER : "mx-auto max-w-4xl"}>
              {section !== "trades" ? (
                <>
                  <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">
                    {tradeViewAsSeller ? tRequests("titleIncoming") : tRequests("titleSent")}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {tradeViewAsSeller ? tRequests("descriptionIncoming") : tRequests("descriptionSent")}
                  </p>
                </>
              ) : null}

              {tradeViewAsSeller ? (
                <div
                  className={cn(
                    "rounded-2xl border border-zinc-800 bg-zinc-900/50",
                    section === "trades" ? TRADES_HUB_PANEL_CARD : "mt-8 p-4 md:p-6",
                  )}
                >
                  <div className={section === "trades" ? TRADES_HUB_PANEL_CARD_BODY : undefined}>
                  {section !== "trades" ? (
                    <h2 className="text-sm font-semibold text-zinc-200">{tRequests("titleIncoming")}</h2>
                  ) : null}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={consultationRequestViewFilter === "pending" ? "default" : "outline"}
                      onClick={() => setConsultationRequestViewFilter("pending")}
                      className={
                        consultationRequestViewFilter === "pending"
                          ? "bg-red-600 text-white hover:bg-red-500"
                          : "border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
                      }
                    >
                      {tRequests("filterPending")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={consultationRequestViewFilter === "handled" ? "default" : "outline"}
                      onClick={() => setConsultationRequestViewFilter("handled")}
                      className={
                        consultationRequestViewFilter === "handled"
                          ? "bg-red-600 text-white hover:bg-red-500"
                          : "border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
                      }
                    >
                      {tRequests("filterHandled")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={consultationRequestViewFilter === "all" ? "default" : "outline"}
                      onClick={() => setConsultationRequestViewFilter("all")}
                      className={
                        consultationRequestViewFilter === "all"
                          ? "bg-red-600 text-white hover:bg-red-500"
                          : "border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
                      }
                    >
                      {tRequests("filterAll")}
                    </Button>
                  </div>
                  {consultationRequestsLoading ? (
                    <div className="flex items-center justify-center py-12 text-zinc-400">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                      {tCommon("loading")}
                    </div>
                  ) : consultationRequestsError ? (
                    <p className="py-8 text-center text-sm text-red-400">{consultationRequestsError}</p>
                  ) : filteredConsultationRequests.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      {consultationRequestViewFilter === "pending"
                        ? tRequests("emptyPending")
                        : consultationRequestViewFilter === "handled"
                          ? tRequests("emptyHandled")
                          : tRequests("emptyAll")}
                    </p>
                  ) : (
                    <ul className="space-y-4">
                      {filteredConsultationRequests.map((item) => {
                        const busy = consultationActionBusyId === item.id
                        return (
                          <li key={item.id} className="rounded-xl border border-border bg-card/70 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="font-semibold text-white">{item.skillTitle}</p>
                                <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
                                  <Link
                                    href={item.buyerProfilePath}
                                    className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
                                  >
                                    <ProfileAvatar
                                      avatarUrl={item.buyerAvatarUrl}
                                      alt={item.buyerDisplayName}
                                      className="h-7 w-7 border border-zinc-700"
                                      sizes="28px"
                                      iconClassName="min-h-2.5 min-w-2.5 max-h-4 max-w-4"
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
                                {item.status === "pending"
                                  ? tRequests("statusPending")
                                  : item.status === "accepted"
                                    ? tRequests("statusAccepted")
                                    : tRequests("statusRejected")}
                              </span>
                            </div>

                            <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
                              {item.q1Label ? (
                                <p className="text-zinc-300">
                                  <span className="font-semibold text-zinc-200">{item.q1Label}:</span> {item.a1Text || tRequests("notInput")}
                                </p>
                              ) : null}
                              {item.q2Label ? (
                                <p className="text-zinc-300">
                                  <span className="font-semibold text-zinc-200">{item.q2Label}:</span> {item.a2Text || tRequests("notInput")}
                                </p>
                              ) : null}
                              {item.q3Label ? (
                                <p className="text-zinc-300">
                                  <span className="font-semibold text-zinc-200">{item.q3Label}:</span> {item.a3Text || tRequests("notInput")}
                                </p>
                              ) : null}
                              {item.freeLabel ? (
                                <p className="text-zinc-300">
                                  <span className="font-semibold text-zinc-200">{item.freeLabel}:</span> {item.freeText || tRequests("notInput")}
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
                                    {tRequests("approve")}
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
                                    {tRequests("reject")}
                                  </Button>
                                </div>
                                {rejectConfirmTargetId === item.id ? (
                                  <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold text-zinc-300">{tRequests("rejectReasonLabel")}</p>
                                      <textarea
                                        rows={3}
                                        value={rejectOptionalReason}
                                        onChange={(event) => setRejectOptionalReason(event.target.value)}
                                        placeholder={tRequests("rejectReasonPlaceholder")}
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
                                        {tRequests("cancel")}
                                      </Button>
                                      <Button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void handleRejectConsultation(item, rejectOptionalReason)}
                                        className="h-9 flex-1 bg-rose-600 text-white hover:bg-rose-500"
                                      >
                                        {tRequests("confirmReject")}
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
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-2xl border border-zinc-800 bg-zinc-900/50",
                    section === "trades" ? TRADES_HUB_PANEL_CARD : "mt-8 p-4 md:p-6",
                  )}
                >
                  <div className={section === "trades" ? TRADES_HUB_PANEL_CARD_BODY : undefined}>
                  {section !== "trades" ? (
                    <>
                      <h2 className="text-sm font-semibold text-zinc-200">{tRequests("titleSent")}</h2>
                      <p className="mt-1 text-xs text-zinc-500">{tRequests("sentSecondaryDescription")}</p>
                    </>
                  ) : null}
                  {sentConsultationRequestsLoading ? (
                    <div className="flex items-center justify-center py-12 text-zinc-400">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                      {tCommon("loading")}
                    </div>
                  ) : sentConsultationRequestsError ? (
                    <p className="py-8 text-center text-sm text-red-400">{sentConsultationRequestsError}</p>
                  ) : sentConsultationRequests.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">{tRequests("emptySent")}</p>
                  ) : (
                    <ul className="mt-4 space-y-4">
                      {sentConsultationRequests.map((item) => (
                        <li key={item.id} className="rounded-xl border border-border bg-card/70 p-4">
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
                                  <ProfileAvatar
                                    avatarUrl={item.sellerAvatarUrl}
                                    alt={item.sellerDisplayName}
                                    className="h-7 w-7 border border-zinc-700"
                                    sizes="28px"
                                    iconClassName="min-h-2.5 min-w-2.5 max-h-4 max-w-4"
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
                                ? tRequests("statusPendingShort")
                                : item.status === "accepted"
                                  ? tRequests("statusAccepted")
                                  : tRequests("statusRejected")}
                            </span>
                          </div>
                          {item.status === "rejected" ? (
                            <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-3 text-sm text-rose-100">
                              <p className="font-semibold">{tRequests("rejectionReasonHeading")}</p>
                              <p className="mt-1 whitespace-pre-wrap text-rose-100/90">
                                {item.rejectionReason || tRequests("rejectionReasonEmpty")}
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
            </div>
          )}

          {section === "favorites" && (
            <div className="mx-auto max-w-3xl">
              <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tFavoritesNs("title")}</h1>
              <p className="mt-1 text-sm text-zinc-400">{tFavoritesNs("subtitle")}</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {favoritesLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    {tCommon("loading")}
                  </div>
                ) : favoritesError ? (
                  <p className="py-8 text-center text-sm text-red-400">{favoritesError}</p>
                ) : favoriteSkills.length === 0 ? (
                  <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
                    {tFavoritesNs("empty")}
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
                              {formatCurrencyPlain(Number(skill.price), normalizeCurrency(skill.currency))}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-zinc-600 bg-zinc-950 text-zinc-100 hover:border-red-500 hover:bg-zinc-900"
                          onClick={() => void handleUnfavorite(skill.favoriteId)}
                          aria-label={tFavoritesNs("removeAria")}
                        >
                          <Heart className="mr-1.5 h-3.5 w-3.5 fill-red-500 text-red-500" aria-hidden />
                          {tFavoritesNs("remove")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {section === "reviews" && (
            <div className="w-full">
              <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{tReviewsNs("title")}</h1>
              <p className="mt-1 text-sm text-zinc-400">{tReviewsNs("subtitle")}</p>

              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-6">
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    {tCommon("loading")}
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
                            <div className="w-10 shrink-0 text-zinc-300 md:w-12">{tReviewsNs("starLabel", { count: String(stars) })}</div>
                            <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-red-500 transition-all"
                                style={{ width: `${percentage}%` }}
                                aria-hidden
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedReviewStars((prev) => (prev === stars ? null : stars))}
                              className={`min-w-14 shrink-0 text-right transition-colors ${
                                selectedReviewStars === stars
                                  ? "font-semibold text-red-300"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              {tReviewsNs("starCount", { count: String(count) })}
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    <p className="mt-5 text-sm text-zinc-300">
                      {tReviewsNs("averagePrefix")}<span className="font-bold text-white">{Number(profileRatingAvg ?? 0).toFixed(1)}</span> {tReviewsNs("reviewCountSuffix", { count: String(profileReviewCount) })}
                    </p>

                    <div className="mt-8 border-t border-zinc-800 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">{tReviewsNs("commentsHeading")}</h3>
                        {selectedReviewStars != null ? (
                          <button
                            type="button"
                            onClick={() => setSelectedReviewStars(null)}
                            className="text-xs text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
                          >
                            {tReviewsNs("filterCurrent", { count: String(selectedReviewStars) })}
                          </button>
                        ) : null}
                      </div>
                      {filteredReviewComments.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-500">{tReviewsNs("emptyComments")}</p>
                      ) : (
                        <div className="mt-4 max-h-96 w-full space-y-3 overflow-y-auto pr-1 md:max-h-none md:overflow-visible">
                          {filteredReviewComments.map((reviewComment) => {
                            const displayDate = formatRatingDate(reviewComment.createdAt, htmlLang)
                            return (
                              <article
                                key={reviewComment.id}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-white">
                                    {reviewComment.senderName.length > 0
                                      ? reviewComment.senderName
                                      : tReviewsNs("unnamedReviewer")}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5" aria-label={tReviewsNs("commentRatingAria", { value: String(reviewComment.rating) })}>
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

          {(activeContentSection === "learning" || activeContentSection === "teaching") && (
            <div className={section === "trades" ? TRADES_HUB_PANEL_OUTER : "mx-auto max-w-3xl"}>
              {section !== "trades" ? (
                <>
                  <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">
                    {activeContentSection === "learning" ? tTrades("titleLearning") : tTrades("titleTeaching")}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {activeContentSection === "learning" ? tTrades("descriptionLearning") : tTrades("descriptionTeaching")}
                  </p>
                </>
              ) : null}

              <div
                className={cn(
                  "rounded-2xl border border-zinc-800 bg-zinc-900/50",
                  section === "trades" ? TRADES_HUB_PANEL_CARD : "mt-8 p-4 md:p-6",
                )}
              >
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    {tCommon("loading")}
                  </div>
                ) : transactionsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{transactionsError}</p>
                ) : transactionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {activeContentSection === "learning" ? tTrades("emptyLearning") : tTrades("emptyTeaching")}
                  </p>
                ) : (
                  <div className={section === "trades" ? TRADES_HUB_PANEL_CARD_BODY : undefined}>
                  <ul className="space-y-4">
                    {transactionItems.map((item) => (
                      <li
                        key={item.transactionId}
                        className="rounded-2xl border border-border bg-card/70 p-4 transition-colors hover:border-red-500/40 hover:bg-zinc-900/70"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            {item.skillImageUrl ? (
                              <div
                                className="w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                                style={{
                                  ...skillThumbnailContainerAspectStyle(),
                                  backgroundImage: `url(${item.skillImageUrl})`,
                                }}
                                role="img"
                                aria-hidden
                              />
                            ) : (
                              <div
                                className="w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700"
                                style={skillThumbnailContainerAspectStyle()}
                              >
                                <ProfileAvatar
                                  avatarUrl={item.peerAvatarUrl}
                                  alt={item.peerDisplayName}
                                  className="h-full w-full"
                                  roundedClassName="rounded-none"
                                  sizes="112px"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-base font-bold text-white md:text-lg">{item.skillTitle}</p>
                              <p className="mt-1 text-sm text-zinc-400">{tTrades("peerInstructor")}: {item.peerDisplayName}</p>
                              <p className="mt-1 text-xs text-zinc-500">{item.startedAtLabel}</p>
                              <p className="mt-1 text-[11px] text-zinc-500">{tTrades("transactionIdLabel", { id: item.transactionId })}</p>
                            </div>
                          </div>
                          <Button
                            asChild
                            className="h-10 w-full shrink-0 bg-red-600 text-sm font-semibold text-white hover:bg-red-500 sm:w-auto sm:px-5"
                          >
                            <Link href={`/chat/${encodeURIComponent(item.transactionId)}`}>{tTrades("toChat")}</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeContentSection === "transactions" && (
            <div className={section === "trades" ? TRADES_HUB_PANEL_OUTER : "mx-auto max-w-3xl"}>
              {section !== "trades" ? (
                <>
                  <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">
                    {tradeViewAsSeller ? tHistory("titleSeller") : tHistory("titleBuyer")}
                  </h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    {tradeViewAsSeller ? tHistory("descriptionSeller") : tHistory("descriptionBuyer")}
                  </p>
                </>
              ) : null}

              <div
                className={cn(
                  "rounded-2xl border border-zinc-800 bg-zinc-900/50",
                  section === "trades" ? TRADES_HUB_PANEL_CARD : "mt-8 p-4 md:p-6",
                )}
              >
                {historyTransactionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
                    {tCommon("loading")}
                  </div>
                ) : historyTransactionsError ? (
                  <p className="py-8 text-center text-sm text-red-400">{historyTransactionsError}</p>
                ) : historyTransactionItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    {tradeViewAsSeller ? tHistory("emptySeller") : tHistory("emptyBuyer")}
                  </p>
                ) : (
                  <div className={section === "trades" ? TRADES_HUB_PANEL_CARD_BODY : undefined}>
                  <>
                    <ul className="space-y-4">
                      {paginatedHistoryTransactionItems.map((item) => (
                        <li
                          key={item.transactionId}
                          className="rounded-2xl border border-border bg-card/70 p-4 transition-colors hover:border-red-500/40 hover:bg-zinc-900/70"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              {item.skillImageUrl ? (
                                <div
                                  className="w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 bg-cover bg-center"
                                  style={{
                                    ...skillThumbnailContainerAspectStyle(),
                                    backgroundImage: `url(${item.skillImageUrl})`,
                                  }}
                                  role="img"
                                  aria-hidden
                                />
                              ) : (
                                <div
                                  className="w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-700"
                                  style={skillThumbnailContainerAspectStyle()}
                                >
                                  <ProfileAvatar
                                    avatarUrl={item.peerAvatarUrl}
                                    alt={item.peerDisplayName}
                                    className="h-full w-full"
                                    roundedClassName="rounded-none"
                                    sizes="112px"
                                  />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-base font-bold text-white md:text-lg">{item.skillTitle}</p>
                                <p className="mt-1 text-sm text-zinc-400">
                                  {tradeViewAsSeller ? tTrades("peerBuyer") : tTrades("peerSeller")}: {item.peerDisplayName}
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
                                <Link href={`/chat/${encodeURIComponent(item.transactionId)}`}>{tTrades("toChat")}</Link>
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-500">
                        {tHistory("summary", {
                          total: historyTransactionItems.length.toLocaleString(htmlLang),
                          start: String(historyRangeStart),
                          end: String(historyRangeEnd),
                        })}
                      </p>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                          className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80 disabled:opacity-50"
                        >
                          {tHistory("prev")}
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
                          className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80 disabled:opacity-50"
                        >
                          {tHistory("next")}
                        </Button>
                      </div>
                    </div>
                  </>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === "payout" && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left sm:p-8">
              <h1 className="text-xl font-bold text-foreground">{tPayout("title")}</h1>
              {!isStripeSetupComplete ? (
                <div className="mt-6 rounded-xl border border-border bg-card/60 p-4">
                  <p className="text-sm text-zinc-400">{tPayout("notRegisteredHint")}</p>
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
                          {tPayout("issuing")}
                        </>
                      ) : (
                        tPayout("startStripe")
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">{tPayout("registeredHint")}</p>
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
                          {tPayout("issuing")}
                        </>
                      ) : (
                        tPayout("openDashboard")
                      )}
                    </Button>
                  </div>
                </>
              )}

              {isStripeSetupComplete ? (
                <div className="mt-6 rounded-xl border border-border bg-card/60 p-4">
                  <h2 className="text-sm font-semibold text-zinc-200">{tPayout("balanceHeading")}</h2>
                  {connectBalanceLoading ? (
                    <div className="mt-3 flex items-center text-sm text-zinc-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" aria-hidden />
                      {tPayout("balanceLoading")}
                    </div>
                  ) : connectBalanceError ? (
                    <p className="mt-3 text-sm text-red-400">{connectBalanceError}</p>
                  ) : (
                    <div className="mt-3 text-sm text-zinc-300">
                      <div className="flex flex-col gap-6">
                        <p>{tPayout("balanceTotal", { amount: (connectBalance?.total ?? 0).toLocaleString(htmlLang) })}</p>
                        <p>{tPayout("balancePending", { amount: (connectBalance?.pending ?? 0).toLocaleString(htmlLang) })}</p>
                        <p>{tPayout("balanceAvailable", { amount: (connectBalance?.available ?? 0).toLocaleString(htmlLang) })}</p>
                      </div>
                      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                        {tPayout("balanceNote")}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <p className="mt-6 text-xs text-zinc-500">
                {tPayout("disclaimer")}
              </p>
            </div>
          )}

          {section === "account" && (
            <div className="mx-auto max-w-2xl space-y-8">
              <div>
                <h1 className="text-2xl font-black tracking-wide text-foreground md:text-3xl">{accountLabel}</h1>
                <p className="mt-1 text-sm text-zinc-400">{tAccount("subtitle")}</p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left shadow-[0_0_40px_rgba(0,0,0,0.25)] md:p-8">
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
                  <ProfileAvatar
                    avatarUrl={profileAvatarUrl}
                    alt={displayName || tAccount("anonymousUser")}
                    className="h-20 w-20"
                    ringClassName="border border-zinc-700 ring-2 ring-red-500/25"
                    sizes="80px"
                  />
                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{tAccount("displayNameHeading")}</p>
                    <p className="mt-1 max-w-full truncate text-xl font-bold text-foreground">
                      {profileLoading ? tCommon("loading") : displayName || tAccount("notSet")}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">{tAccount("profileEditHint")}</p>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">{tAccount("themeHeading")}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {tAccount("themeHint")}
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-200">
                      {!themeReady ? tCommon("loading") : tAccount("themeDarkLabel")}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={themeReady && isDarkMode}
                      aria-label={tAccount("themeToggleAria")}
                      disabled={!themeReady}
                      onClick={handleThemeToggle}
                      className={`flex h-8 w-14 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-60 ${
                        themeReady && isDarkMode
                          ? "bg-red-600 focus-visible:ring-red-500"
                          : "bg-zinc-600 focus-visible:ring-zinc-500"
                      }`}
                    >
                      <span
                        className={`block h-6 w-6 rounded-full bg-white shadow-md transition-[margin] duration-200 ease-out ${
                          themeReady && isDarkMode ? "ml-auto" : "ml-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">{tAccount("accentHeading")}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {tAccount("accentHint")}
                  </p>
                  <div className="mt-4 max-w-xs">
                    <label htmlFor="account-accent-color" className="sr-only">
                      {tAccount("accentAria")}
                    </label>
                    <select
                      id="account-accent-color"
                      value={accentColorValue}
                      onChange={(event) => handleAccentColorChange(event.target.value)}
                      className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {ACCENT_COLOR_OPTIONS.map((option) => (
                        <option key={option.id} value={option.value}>
                          {tAccentColors(option.id, option.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800 pt-8">
                  <h2 className="text-sm font-semibold text-zinc-200">{tAccount("emailHeading")}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {tAccount("emailIntro1")}
                    {tAccount("emailIntro2")}<strong className="font-semibold text-zinc-300">{tAccount("emailInAppBold")}</strong>
                    {tAccount("emailIntro3")}
                  </p>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-3">
                    <span className="text-sm font-medium text-zinc-200">{tAccount("emailMaster")}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={emailNotificationSettings.master}
                      aria-label={tAccount("emailMasterAria")}
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
                            disabled ? "border-border bg-card/40 opacity-70" : "border-zinc-700 bg-zinc-950/60"
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
                            aria-label={tAccount("emailItemAria", { label: item.label })}
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
                  <h2 className="text-sm font-semibold text-zinc-200">{tAccount("loginHeading")}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {tAccount("loginHint")}
                  </p>
                  <Button
                    type="button"
                    className="mt-4 h-12 w-full bg-red-600 text-base font-bold text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-500 disabled:opacity-60 sm:w-auto sm:min-w-[12rem] sm:px-8"
                    onClick={handleAccountLogoutRequest}
                    disabled={accountLogoutBusy}
                  >
                    {tAccount("logoutButton")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showStripeOnboardingConfirm ? (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
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
              {tStripeConfirm("title")}
            </h2>

            <div className="mt-4 rounded-xl border border-border bg-muted p-4">
              <p className="text-sm font-semibold text-zinc-200">
                {tStripeConfirm("defaultsHeading")}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-zinc-300">
                <li>{tStripeConfirm("country")}</li>
                <li>{tStripeConfirm("business")}</li>
                <li>{tStripeConfirm("industry")}</li>
                <li>{tStripeConfirm("url")}</li>
                <li>{tStripeConfirm("description")}</li>
              </ul>
            </div>

            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-200">
                <ShieldAlert className="h-4 w-4" />
                {tStripeConfirm("cautionHeading")}
              </p>
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-200">
                <li>{tStripeConfirm("caution1")}</li>
                <li>{tStripeConfirm("caution2")}</li>
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
                {tStripeConfirm("cancel")}
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
                    {tStripeConfirm("proceedBusy")}
                  </>
                ) : (
                  tStripeConfirm("proceed")
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
            <p className="text-base font-bold text-white">{tPayoutBusy("title")}</p>
            <p className="text-sm leading-relaxed text-zinc-300">
              {tPayoutBusy("body")}
            </p>
          </div>
        </div>
      ) : null}

      {typeof document !== "undefined" &&
        showCustomIdConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-6"
            role="presentation"
            onClick={handleCustomIdConfirmCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="custom-id-confirm-title"
              className="my-auto w-full min-w-0 max-w-md shrink-0 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="custom-id-confirm-title" className="text-base font-semibold leading-relaxed text-zinc-100">
                {tCustomIdConfirm("title")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {tCustomIdConfirm("intro")}
              </p>
              <div className="mt-3 min-w-0 w-full overflow-hidden rounded-lg border border-red-500/35 bg-zinc-900 px-3 py-2">
                <p className="font-mono text-xs leading-relaxed break-all text-red-200 [overflow-wrap:anywhere] sm:text-sm">
                  https://gritvib.com/store/{pendingCustomIdForConfirm}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {tCustomIdConfirm("warning")}
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={handleCustomIdConfirmCancel}
                  disabled={profileSaving}
                >
                  {tCustomIdConfirm("back")}
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-semibold text-white hover:bg-red-500"
                  onClick={handleCustomIdConfirmProceed}
                  disabled={profileSaving}
                >
                  {tCustomIdConfirm("proceed")}
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
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-6"
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
                {tListings("confirmTitle")}
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-400">
                {tListings("confirmBody", {
                  title:
                    listings.find((item) => item.id === listingPublishConfirmId)?.title ?? tListings("fallbackSkill"),
                })}
              </p>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={() => setListingPublishConfirmId(null)}
                  disabled={Boolean(publishingListingId)}
                >
                  {tListings("cancel")}
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
                      {tListings("publishing")}
                    </>
                  ) : (
                    tListings("publish")
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
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 sm:p-6"
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
                {tLogoutConfirm("title")}
              </h2>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
                  onClick={handleAccountLogoutCancel}
                  disabled={accountLogoutBusy}
                >
                  {tLogoutConfirm("cancel")}
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
                      {tLogoutConfirm("busy")}
                    </>
                  ) : (
                    tLogoutConfirm("confirm")
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
