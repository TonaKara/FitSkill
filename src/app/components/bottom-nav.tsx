"use client"

import { Suspense, useEffect, useMemo, useRef, useState, startTransition } from "react"
import { Home, Heart, PlusCircle, MessageCircle, User } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"

const navItems = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "favorites", label: "お気に入り", icon: Heart },
  { id: "create", label: "出品", icon: PlusCircle },
  { id: "messages", label: "メッセージ", icon: MessageCircle },
  { id: "profile", label: "プロフィール", icon: User },
]

/** 現在の URL に対応するボトムナビの選択状態（クリックだけのローカル state に依存しない） */
function resolveBottomNavActiveId(pathname: string, searchParams: URLSearchParams): string | null {
  if (pathname === "/") {
    return "home"
  }
  if (pathname.startsWith("/create-skill")) {
    return "create"
  }
  if (pathname === "/mypage" || pathname.startsWith("/mypage/")) {
    const tab = searchParams.get("tab")
    if (tab === "favorites") {
      return "favorites"
    }
    if (tab === "learning" || tab === "teaching") {
      return "messages"
    }
    if (tab === "profile" || tab === "reviews" || tab === "account") {
      return "profile"
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

/**
 * 連続タップで古い非同期ハンドラが後から `router.push` しないよう、
 * ナビ操作ごとにトークンを進めて打ち消す。
 */
function useNavIntentGuard() {
  const seqRef = useRef(0)
  const beginIntent = () => {
    seqRef.current += 1
    return seqRef.current
  }
  const isStale = (token: number) => token !== seqRef.current
  return { beginIntent, isStale }
}

function BottomNavInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isMobileMenuOpen } = useMobileHeaderMenu()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { beginIntent, isStale } = useNavIntentGuard()

  const [isCreateChecking, setIsCreateChecking] = useState(false)
  const [isFavoritesChecking, setIsFavoritesChecking] = useState(false)
  const [isMessagesChecking, setIsMessagesChecking] = useState(false)
  const [isProfileChecking, setIsProfileChecking] = useState(false)

  const navActiveId = useMemo(
    () => resolveBottomNavActiveId(pathname, searchParams),
    [pathname, searchParams],
  )

  useEffect(() => {
    router.prefetch("/")
    router.prefetch("/mypage?tab=favorites")
    router.prefetch("/mypage?tab=profile")
    router.prefetch("/mypage?tab=learning")
    router.prefetch("/mypage?tab=teaching")
    router.prefetch("/create-skill")
    router.prefetch("/login")
  }, [router])

  const leftItems = navItems.slice(0, 2)
  const createItem = navItems.find((item) => item.id === "create")
  const rightItems = navItems.slice(3)

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

  const handleFavoritesClick = async () => {
    if (isFavoritesChecking) {
      return
    }
    const intent = beginIntent()
    setIsFavoritesChecking(true)
    const { data } = await supabase.auth.getSession()
    if (isStale(intent)) {
      setIsFavoritesChecking(false)
      return
    }
    setIsFavoritesChecking(false)

    if (data.session?.user) {
      pushNav(router, "/mypage?tab=favorites")
      return
    }

    pushNav(router, "/login")
  }

  const handleMessagesClick = async () => {
    if (isMessagesChecking) {
      return
    }
    const intent = beginIntent()
    setIsMessagesChecking(true)
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user

    if (!user) {
      if (isStale(intent)) {
        setIsMessagesChecking(false)
        return
      }
      setIsMessagesChecking(false)
      pushNav(router, "/login")
      return
    }

    const targetStatuses = ["active", "approval_pending", "disputed"]
    const { data: rows } = await supabase
      .from("transactions")
      .select("buyer_id, seller_id")
      .in("status", targetStatuses)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .limit(40)

    if (isStale(intent)) {
      setIsMessagesChecking(false)
      return
    }
    setIsMessagesChecking(false)

    const list = rows ?? []
    const asBuyer = list.some((r) => r.buyer_id === user.id)
    const asSeller = list.some((r) => r.seller_id === user.id)

    if (asBuyer) {
      pushNav(router, "/mypage?tab=learning")
      return
    }
    if (asSeller) {
      pushNav(router, "/mypage?tab=teaching")
      return
    }

    pushNav(router, "/mypage?tab=learning")
  }

  const handleProfileClick = async () => {
    if (isProfileChecking) {
      return
    }
    const intent = beginIntent()
    setIsProfileChecking(true)
    const { data } = await supabase.auth.getSession()
    if (isStale(intent)) {
      setIsProfileChecking(false)
      return
    }
    setIsProfileChecking(false)

    if (data.session?.user) {
      pushNav(router, "/mypage?tab=profile")
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
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80 transform-gpu will-change-transform md:hidden",
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
                if (item.id === "favorites") {
                  void handleFavoritesClick()
                  return
                }
                if (item.id === "home") {
                  beginIntent()
                  pushNav(router, "/")
                  return
                }
              }}
              disabled={item.id === "favorites" && isFavoritesChecking}
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
                if (item.id === "messages") {
                  void handleMessagesClick()
                  return
                }
                if (item.id === "profile") {
                  void handleProfileClick()
                  return
                }
              }}
              disabled={
                (item.id === "messages" && isMessagesChecking) || (item.id === "profile" && isProfileChecking)
              }
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
