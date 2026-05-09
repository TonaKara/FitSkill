"use client"

import { Home, Heart, PlusCircle, MessageCircle, User } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useMemo, useState } from "react"
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"

const navItems = [
  { id: "home", label: "ホーム", icon: Home },
  { id: "favorites", label: "お気に入り", icon: Heart },
  { id: "create", label: "出品", icon: PlusCircle },
  { id: "messages", label: "メッセージ", icon: MessageCircle },
  { id: "profile", label: "マイページ", icon: User },
]

export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobileMenuOpen } = useMobileHeaderMenu()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [activeItem, setActiveItem] = useState("home")
  const [isCreateChecking, setIsCreateChecking] = useState(false)
  const [isFavoritesChecking, setIsFavoritesChecking] = useState(false)
  const [isMessagesChecking, setIsMessagesChecking] = useState(false)
  const [isProfileChecking, setIsProfileChecking] = useState(false)
  const leftItems = navItems.slice(0, 2)
  const createItem = navItems.find((item) => item.id === "create")
  const rightItems = navItems.slice(3)

  const handleCreateClick = async () => {
    if (isCreateChecking) {
      return
    }

    setActiveItem("create")
    setIsCreateChecking(true)
    const { data } = await supabase.auth.getUser()
    setIsCreateChecking(false)

    if (data.user) {
      router.push("/create-skill")
      return
    }

    router.push("/login")
  }

  const handleFavoritesClick = async () => {
    if (isFavoritesChecking) {
      return
    }

    setActiveItem("favorites")
    setIsFavoritesChecking(true)
    const { data } = await supabase.auth.getUser()
    setIsFavoritesChecking(false)

    if (data.user) {
      router.push("/mypage?tab=favorites")
      return
    }

    router.push("/login")
  }

  const handleMessagesClick = async () => {
    if (isMessagesChecking) {
      return
    }

    setActiveItem("messages")
    setIsMessagesChecking(true)
    const { data } = await supabase.auth.getUser()
    const user = data.user

    if (!user) {
      setIsMessagesChecking(false)
      router.push("/login")
      return
    }

    const targetStatuses = ["active", "approval_pending", "disputed"]
    const [learningResult, teachingResult] = await Promise.all([
      supabase.from("transactions").select("id").eq("buyer_id", user.id).in("status", targetStatuses).limit(1),
      supabase.from("transactions").select("id").eq("seller_id", user.id).in("status", targetStatuses).limit(1),
    ])

    setIsMessagesChecking(false)

    const hasLearning = (learningResult.data?.length ?? 0) > 0
    const hasTeaching = (teachingResult.data?.length ?? 0) > 0

    if (hasLearning) {
      router.push("/mypage?tab=learning")
      return
    }
    if (hasTeaching) {
      router.push("/mypage?tab=teaching")
      return
    }

    router.push("/mypage?tab=learning")
  }

  const handleProfileClick = async () => {
    if (isProfileChecking) {
      return
    }

    setActiveItem("profile")
    setIsProfileChecking(true)
    const { data } = await supabase.auth.getUser()
    setIsProfileChecking(false)

    if (data.user) {
      router.push("/mypage")
      return
    }

    router.push("/login")
  }

  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden",
        isMobileMenuOpen && "hidden",
      )}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-4">
        {leftItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "favorites") {
                  void handleFavoritesClick()
                  return
                }
                if (item.id === "home") {
                  setActiveItem(item.id)
                  router.push("/")
                  return
                }
                setActiveItem(item.id)
              }}
              disabled={item.id === "favorites" && isFavoritesChecking}
              className="flex flex-col items-center gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
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
            onClick={() => void handleCreateClick()}
            disabled={isCreateChecking}
            className="relative -mt-4 flex flex-col items-center gap-1 transition-colors"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
              <createItem.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium text-primary">{createItem.label}</span>
          </button>
        ) : null}
        {rightItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "messages") {
                  void handleMessagesClick()
                  return
                }
                if (item.id === "profile") {
                  void handleProfileClick()
                  return
                }
                setActiveItem(item.id)
              }}
              disabled={
                (item.id === "messages" && isMessagesChecking) || (item.id === "profile" && isProfileChecking)
              }
              className="flex flex-col items-center gap-1 transition-colors"
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
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
