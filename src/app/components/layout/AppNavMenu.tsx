"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronDown, Shield } from "lucide-react"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  buildAppSidebarNavItems,
  buildTradesSubmenuHref,
  isTradesSidebarRoute,
  isTradesSubmenuPanelActive,
  TRADES_SIDEBAR_MENU,
  TRADES_SIDEBAR_SUBMENU,
} from "@/lib/app-sidebar-nav"
import { cn } from "@/lib/utils"

export function sidebarLinkClass(active: boolean, size: "main" | "sub" = "main") {
  return cn(
    "block w-full rounded-lg text-left font-medium transition-colors",
    size === "main" ? "px-3 py-2.5 text-sm" : "py-2 pl-8 pr-3 text-[13px]",
    active
      ? size === "main"
        ? "bg-primary/15 text-primary-readable"
        : "bg-primary/10 text-primary-readable"
      : size === "main"
        ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
        : "text-muted-foreground hover:bg-primary/5 hover:text-primary-readable",
  )
}

type AppNavMenuProps = {
  /** 未ログイン時は「スキルを探す」のみ表示 */
  guestMode?: boolean
  onNavigate?: () => void
  className?: string
}

export function AppNavMenu({ guestMode = false, onNavigate, className }: AppNavMenuProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const onTradesRoute = isTradesSidebarRoute(pathname)
  const onAdminRoute = pathname.startsWith("/admin")
  const navItems = buildAppSidebarNavItems()
  const TradesIcon = TRADES_SIDEBAR_MENU.icon

  useEffect(() => {
    if (onTradesRoute) {
      setIsTransactionOpen(true)
    }
  }, [onTradesRoute])

  useEffect(() => {
    if (guestMode) {
      setIsAdmin(false)
      return
    }

    let mounted = true

    const syncAdminFlag = async (userId: string | undefined) => {
      if (!userId) {
        if (mounted) {
          setIsAdmin(false)
        }
        return
      }
      const admin = await getIsAdminFromProfile(supabase, userId)
      if (mounted) {
        setIsAdmin(admin)
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      void syncAdminFlag(data.session?.user?.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAdminFlag(session?.user?.id)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [guestMode, supabase])

  const discoverItem = navItems.find((item) => item.id === "discover")

  if (guestMode) {
    if (!discoverItem) {
      return null
    }
    const Icon = discoverItem.icon
    const active = discoverItem.isActive(pathname)
    return (
      <nav className={cn("flex flex-col", className)} aria-label="メニュー">
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            メニュー
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href={discoverItem.href}
                className={cn(sidebarLinkClass(active, "main"), "flex items-center gap-3")}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {discoverItem.label}
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    )
  }

  return (
    <nav className={cn("flex min-h-0 flex-1 flex-col", className)} aria-label="メインメニュー">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            メニュー
          </p>
          <ul className="space-y-0.5">
            {(() => {
              const storeItem = navItems.find((item) => item.id === "store")
              if (!storeItem) {
                return null
              }
              const Icon = storeItem.icon
              const active = storeItem.isActive(pathname)
              return (
                <li key={storeItem.id}>
                  <Link
                    href={storeItem.href}
                    className={cn(sidebarLinkClass(active, "main"), "flex items-center gap-3")}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {storeItem.label}
                  </Link>
                </li>
              )
            })()}

            {discoverItem ? (
              <li key={discoverItem.id}>
                <Link
                  href={discoverItem.href}
                  className={cn(sidebarLinkClass(discoverItem.isActive(pathname), "main"), "flex items-center gap-3")}
                  aria-current={discoverItem.isActive(pathname) ? "page" : undefined}
                  onClick={onNavigate}
                >
                  <discoverItem.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {discoverItem.label}
                </Link>
              </li>
            ) : null}

            <li>
              <button
                type="button"
                onClick={() => setIsTransactionOpen((open) => !open)}
                aria-expanded={isTransactionOpen}
                className={cn(sidebarLinkClass(onTradesRoute, "main"), "flex w-full items-center gap-3")}
              >
                <TradesIcon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 text-left">{TRADES_SIDEBAR_MENU.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isTransactionOpen && "rotate-180",
                    onTradesRoute && "text-primary-readable",
                  )}
                  aria-hidden
                />
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isTransactionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <ul className="min-h-0 overflow-hidden pt-0.5">
                  {TRADES_SIDEBAR_SUBMENU.map((item) => {
                    const subActive = isTradesSubmenuPanelActive(pathname, searchParams, item.panel)
                    return (
                      <li key={item.panel}>
                        <Link
                          href={buildTradesSubmenuHref(item.panel)}
                          className={sidebarLinkClass(subActive, "sub")}
                          aria-current={subActive ? "page" : undefined}
                          onClick={onNavigate}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>

            {(() => {
              const createItem = navItems.find((item) => item.id === "create")
              if (!createItem) {
                return null
              }
              const Icon = createItem.icon
              const active = createItem.isActive(pathname)
              return (
                <li key={createItem.id}>
                  <Link
                    href={createItem.href}
                    className={cn(sidebarLinkClass(active, "main"), "flex items-center gap-3")}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {createItem.label}
                  </Link>
                </li>
              )
            })()}

            {(() => {
              const listingsItem = navItems.find((item) => item.id === "listings")
              if (!listingsItem) {
                return null
              }
              const Icon = listingsItem.icon
              const active = listingsItem.isActive(pathname)
              return (
                <li key={listingsItem.id}>
                  <Link
                    href={listingsItem.href}
                    className={cn(sidebarLinkClass(active, "main"), "flex items-center gap-3")}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {listingsItem.label}
                  </Link>
                </li>
              )
            })()}
          </ul>
        </div>

        <div>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            アカウント
          </p>
          <ul className="space-y-0.5">
            {navItems
              .filter(
                (item) =>
                  item.id !== "store" &&
                  item.id !== "create" &&
                  item.id !== "discover" &&
                  item.id !== "listings",
              )
              .map((item) => {
                const Icon = item.icon
                const active = item.isActive(pathname)
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(sidebarLinkClass(active, "main"), "flex items-center gap-3")}
                      aria-current={active ? "page" : undefined}
                      onClick={onNavigate}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
          </ul>
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 shrink-0 border-t border-border pt-4">
          <Link
            href="/admin"
            className={cn(sidebarLinkClass(onAdminRoute, "main"), "flex items-center gap-3")}
            aria-current={onAdminRoute ? "page" : undefined}
            onClick={onNavigate}
          >
            <Shield className="h-5 w-5 shrink-0" aria-hidden />
            管理者ページ
          </Link>
        </div>
      ) : null}
    </nav>
  )
}
