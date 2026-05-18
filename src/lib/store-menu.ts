import type { LucideIcon } from "lucide-react"
import { Heart, MessageSquare, Package, Settings, Star, User, Wallet } from "lucide-react"
import {
  readMypageModePreference,
  type MypageModePreference,
} from "@/lib/mypage-mode-preference"
import type { TradesPanel, TradesSide } from "@/lib/mypage-trades"

export type AccountSectionSlug =
  | "profile"
  | "sales"
  | "trades"
  | "favorites"
  | "reviews"
  | "settings"
  | "listings"

export type StoreMenuItem = {
  slug: AccountSectionSlug
  label: string
  description: string
  icon: LucideIcon
}

/** ストア管理メニュー（ダッシュボード・ユーザーメニュー共通） */
export const STORE_MENU_ITEMS: StoreMenuItem[] = [
  {
    slug: "profile",
    label: "プロフィール設定",
    description: "表示名・アイコン・自己紹介",
    icon: User,
  },
  {
    slug: "sales",
    label: "売上の確認",
    description: "振込設定・Stripe 残高",
    icon: Wallet,
  },
  {
    slug: "listings",
    label: "出品中の商品管理",
    description: "公開・非公開・編集",
    icon: Package,
  },
  {
    slug: "trades",
    label: "取引・メッセージ",
    description: "購入・受注・相談・チャット",
    icon: MessageSquare,
  },
  {
    slug: "favorites",
    label: "お気に入り",
    description: "気になるストアや商品",
    icon: Heart,
  },
  {
    slug: "reviews",
    label: "評価",
    description: "レビューと評価の確認",
    icon: Star,
  },
  {
    slug: "settings",
    label: "設定",
    description: "アカウント・通知",
    icon: Settings,
  },
]

const VALID_ACCOUNT_SLUGS = new Set<string>(STORE_MENU_ITEMS.map((item) => item.slug))

export type MypageSectionKey =
  | "profile"
  | "listings"
  | "trades"
  | "favorites"
  | "reviews"
  | "payout"
  | "account"

export function isAccountSectionSlug(value: string): value is AccountSectionSlug {
  return VALID_ACCOUNT_SLUGS.has(value)
}

export function accountSlugFromMypageSection(section: MypageSectionKey): AccountSectionSlug {
  switch (section) {
    case "profile":
      return "profile"
    case "payout":
      return "sales"
    case "trades":
      return "trades"
    case "favorites":
      return "favorites"
    case "reviews":
      return "reviews"
    case "account":
      return "settings"
    case "listings":
      return "listings"
  }
}

export function pathnameToMypageSection(pathname: string): MypageSectionKey | null {
  const match = pathname.match(/^\/account\/([^/?#]+)/)
  if (!match || !isAccountSectionSlug(match[1])) {
    return null
  }
  switch (match[1]) {
    case "profile":
      return "profile"
    case "sales":
      return "payout"
    case "trades":
      return "trades"
    case "favorites":
      return "favorites"
    case "reviews":
      return "reviews"
    case "settings":
      return "account"
    case "listings":
      return "listings"
  }
}

export function isAccountPath(pathname: string): boolean {
  return pathnameToMypageSection(pathname) !== null
}

export function buildTradesAccountHref(mode?: MypageModePreference): string {
  const resolved = mode ?? readMypageModePreference()
  if (resolved === "instructor") {
    return "/account/trades?side=seller&panel=active"
  }
  return "/account/trades?side=buyer&panel=active"
}

type AccountHrefOptions = {
  mode?: MypageModePreference
  side?: TradesSide
  panel?: TradesPanel
  stripe?: string
  updated?: string
}

export function buildAccountSectionHref(
  section: MypageSectionKey,
  options: AccountHrefOptions = {},
): string {
  const slug = accountSlugFromMypageSection(section)
  const params = new URLSearchParams()

  if (section === "trades") {
    const mode = options.mode ?? readMypageModePreference()
    const side = options.side ?? (mode === "instructor" ? "seller" : "buyer")
    params.set("side", side)
    params.set("panel", options.panel ?? "active")
  } else if (section === "payout") {
    params.set("mode", "instructor")
  } else if (section === "favorites") {
    params.set("mode", "student")
  } else if (section === "listings") {
    params.set("mode", "instructor")
  } else if (options.mode) {
    params.set("mode", options.mode)
  }

  if (options.stripe) {
    params.set("stripe", options.stripe)
  }
  if (options.updated) {
    params.set("updated", options.updated)
  }

  const query = params.toString()
  return query ? `/account/${slug}?${query}` : `/account/${slug}`
}

/** 旧 `/mypage?tab=...` を独立ページ URL に変換 */
export function legacyMypageSearchToAccountHref(searchParams: URLSearchParams): string {
  const tab = searchParams.get("tab")
  const side = searchParams.get("side")
  const panel = searchParams.get("panel")
  const modeParam = searchParams.get("mode")
  const mode =
    modeParam === "student" || modeParam === "instructor" ? modeParam : readMypageModePreference()

  if (tab === "profile") {
    return buildAccountSectionHref("profile")
  }
  if (tab === "payout") {
    const href = buildAccountSectionHref("payout", { mode: "instructor" })
    const stripe = searchParams.get("stripe")
    if (stripe) {
      return `${href}${href.includes("?") ? "&" : "?"}stripe=${encodeURIComponent(stripe)}`
    }
    return href
  }
  if (tab === "favorites") {
    return buildAccountSectionHref("favorites")
  }
  if (tab === "reviews") {
    return buildAccountSectionHref("reviews")
  }
  if (tab === "account") {
    return buildAccountSectionHref("account")
  }
  if (tab === "listings") {
    const base = buildAccountSectionHref("listings")
    const updated = searchParams.get("updated")
    return updated === "1" ? `${base}?updated=1` : base
  }
  if (
    tab === "trades" ||
    tab === "requests" ||
    tab === "inquiry" ||
    tab === "learning" ||
    tab === "teaching" ||
    tab === "transactions"
  ) {
    const tradesSide: TradesSide =
      side === "seller" || side === "buyer" ? side : mode === "instructor" ? "seller" : "buyer"
    const tradesPanel: TradesPanel =
      panel === "offers" || panel === "inquiry" || panel === "active" || panel === "history"
        ? panel
        : tab === "requests"
          ? "offers"
          : tab === "inquiry"
            ? "inquiry"
            : tab === "transactions"
              ? "history"
              : "active"
    return buildAccountSectionHref("trades", { side: tradesSide, panel: tradesPanel, mode })
  }

  return buildTradesAccountHref(mode)
}

export function storeMenuItemHref(item: StoreMenuItem, tradesHref: string): string {
  if (item.slug === "trades") {
    return tradesHref
  }
  if (item.slug === "listings") {
    return buildAccountSectionHref("listings")
  }
  return `/account/${item.slug}`
}
