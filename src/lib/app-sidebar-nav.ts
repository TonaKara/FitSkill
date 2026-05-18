import type { LucideIcon } from "lucide-react"
import { Compass, MessageSquare, Package, PlusCircle, Store } from "lucide-react"
import { buildAccountSectionHref, STORE_MENU_ITEMS, storeMenuItemHref } from "@/lib/store-menu"
import type { TradesPanel } from "@/lib/mypage-trades"
import { parseTradesPanel } from "@/lib/mypage-trades"

export type AppSidebarNavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}

const PRIMARY_NAV: Omit<AppSidebarNavItem, "href" | "isActive">[] = [
  { id: "store", label: "マイストア", icon: Store },
  { id: "discover", label: "スキルを探す", icon: Compass },
  { id: "create", label: "出品", icon: PlusCircle },
  { id: "listings", label: "出品中の商品管理", icon: Package },
]

export const TRADES_SIDEBAR_MENU = {
  id: "trades",
  label: "取引・メッセージ",
  icon: MessageSquare,
} as const

/** サイドバー「取引・メッセージ」アコーディオン内のサブ項目 */
export const TRADES_SIDEBAR_SUBMENU: { panel: TradesPanel; label: string }[] = [
  { panel: "offers", label: "事前オファー" },
  { panel: "inquiry", label: "相談・メッセージ" },
  { panel: "active", label: "進行中の取引" },
  { panel: "history", label: "取引履歴" },
]

export function isTradesSidebarRoute(pathname: string): boolean {
  return pathname.startsWith("/account/trades")
}

export function buildTradesSubmenuHref(panel: TradesPanel): string {
  return buildAccountSectionHref("trades", { panel })
}

export function isTradesSubmenuPanelActive(
  pathname: string,
  searchParams: URLSearchParams,
  panel: TradesPanel,
): boolean {
  if (!isTradesSidebarRoute(pathname)) {
    return false
  }
  return parseTradesPanel(searchParams.get("panel")) === panel
}

export function buildAppSidebarNavItems(): AppSidebarNavItem[] {
  const tradesHref = buildAccountSectionHref("trades", { panel: "active" })

  const primary: AppSidebarNavItem[] = PRIMARY_NAV.map((item) => {
    if (item.id === "store") {
      return {
        ...item,
        href: "/",
        isActive: (pathname) => pathname === "/",
      }
    }
    if (item.id === "discover") {
      return {
        ...item,
        href: "/discover",
        isActive: (pathname) => pathname === "/discover" || pathname.startsWith("/discover/"),
      }
    }
    if (item.id === "listings") {
      return {
        ...item,
        href: buildAccountSectionHref("listings"),
        isActive: (pathname) => pathname.startsWith("/account/listings"),
      }
    }
    return {
      ...item,
      href: "/create-skill",
      isActive: (pathname) => pathname.startsWith("/create-skill"),
    }
  })

  const account: AppSidebarNavItem[] = STORE_MENU_ITEMS.filter(
    (item) => item.slug !== "trades" && item.slug !== "listings",
  ).map(
    (item) => ({
      id: item.slug,
      label: item.label,
      href: storeMenuItemHref(item, tradesHref),
      icon: item.icon,
      isActive: (pathname) => pathname.startsWith(`/account/${item.slug}`),
    }),
  )

  return [...primary, ...account]
}
