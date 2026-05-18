"use client"

import { Suspense, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { Store, Heart, PlusCircle, MessageSquare, Settings } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"
import { buildAccountSectionHref, buildTradesAccountHref } from "@/lib/store-menu"

const navItems = [
  { id: "store", label: "マイストア", icon: Store },
  { id: "trades", label: "取引", icon: MessageSquare },
  { id: "create", label: "出品", icon: PlusCircle },
  { id: "favorites", label: "お気に入り", icon: Heart },
  { id: "settings", label: "設定", icon: Settings },
] as const

function resolveBottomNavActiveId(pathname: string, searchParams: URLSearchParams): string | null {
  if (pathname === "/") {
    return "store"
  }
  if (pathname.startsWith("/create-skill")) {
    return "create"
  }
  if (pathname.startsWith("/account/")) {
    const segment = pathname.split("/")[2]
    if (segment === "favorites") {
      return "favorites"
    }
    if (segment === "trades") {
      return "trades"
    }
    if (
      segment === "profile" ||
      segment === "reviews" ||
      segment === "settings" ||
      segment === "sales" ||
      segment === "listings"
    ) {
      return "settings"
    }
    return null
  }
  return null
}

function pushNav(router: ReturnType<typeof useRouter>, href: string) {
  startTransition(() => {
    router.push(href)
  })
}

function useNavIntentGuard() {
  const seqRef = useRef(0)
  const beginIntent = () => {
    seqRef.current += 1
    return seqRef.current
  }
  const isStale = (token: number) => token !== seqRef.current
  return { beginIntent, isStale }
}

function tradesHrefForMode(): string {
  return buildTradesAccountHref()
}

function BottomNavInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isMobileMenuOpen } = useMobileHeaderMenu()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { beginIntent, isStale } = useNavIntentGuard()

  const [isCreateChecking, setIsCreateChecking] = useState(false)
  const [isAuthNavChecking, setIsAuthNavChecking] = useState(false)

  const navActiveId = useMemo(
    () => resolveBottomNavActiveId(pathname, searchParams),
    [pathname, searchParams],
  )

  useEffect(() => {
    router.prefetch("/")
    router.prefetch("/account/trades?side=buyer&panel=active")
    router.prefetch("/account/trades?side=seller&panel=active")
    router.prefetch("/account/favorites")
    router.prefetch("/account/settings")
    router.prefetch("/create-skill")
    router.prefetch("/login")
  }, [router])

  const leftItems = navItems.slice(0, 2)
  const createItem = navItems.find((item) => item.id === "create")
  const rightItems = navItems.slice(3)

  const requireAuthNav = async (href: string) => {
    if (isAuthNavChecking) {
      return
    }
    const intent = beginIntent()
    setIsAuthNavChecking(true)
    const { data } = await supabase.auth.getSession()
    if (isStale(intent)) {
      setIsAuthNavChecking(false)
      return
    }
    setIsAuthNavChecking(false)
    if (data.session?.user) {
      pushNav(router, href)
      return
    }
    pushNav(router, "/login")
  }

  const handleCreateClick = async () => {
    if (isCreateChecking) {
      return
    }
    const intent = beginIntent()
    setIsCreateChecking(true)
    const { data } = await supabase.auth.getSession()
    if (isStale(intent)) {
      setIsCreateChecking(false)
      return
    }
    setIsCreateChecking(false)
    if (data.session?.user) {
      pushNav(router, "/create-skill")
      return
    }
    pushNav(router, "/login")
  }

  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom,0px)] dark:bg-background/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-background/80 transform-gpu will-change-transform md:hidden",
        isMobileMenuOpen && "hidden",
      )}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-4">
        {leftItems.map((item) => {
          const Icon = item.icon
          const isActive = navActiveId === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "store") {
                  beginIntent()
                  pushNav(router, "/")
                  return
                }
                if (item.id === "trades") {
                  void requireAuthNav(tradesHrefForMode())
                }
              }}
              disabled={isAuthNavChecking && (item.id === "trades")}
              className="flex flex-col items-center gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary-readable" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary-readable" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
        {createItem ? (
          <button
            key={createItem.id}
            type="button"
            onClick={() => void handleCreateClick()}
            disabled={isCreateChecking}
            className="relative -mt-4 flex flex-col items-center gap-1 transition-colors"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
              <createItem.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium text-primary-readable">{createItem.label}</span>
          </button>
        ) : null}
        {rightItems.map((item) => {
          const Icon = item.icon
          const isActive = navActiveId === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "favorites") {
                  void requireAuthNav(buildAccountSectionHref("favorites"))
                  return
                }
                if (item.id === "settings") {
                  void requireAuthNav(buildAccountSectionHref("account"))
                }
              }}
              disabled={isAuthNavChecking}
              className="flex flex-col items-center gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary-readable" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary-readable" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  )
}
