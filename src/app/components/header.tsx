"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, Menu, Search, User } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { navigateAfterLogout } from "@/components/logout-success-toast"
import { useHeaderAuth } from "@/lib/header-auth-context"
import { UserMenu } from "@/components/user-menu"
import { MobileHeaderMenuDrawer } from "@/components/mobile-header-menu-drawer"
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"
import { cn } from "@/lib/utils"
type HeaderProps = {
  searchKeyword?: string
  onSearchKeywordChange?: (value: string) => void
  fixed?: boolean
}

export function Header({ searchKeyword, onSearchKeywordChange, fixed = false }: HeaderProps = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { isMobileMenuOpen: isMenuOpen, setMobileMenuOpen: setIsMenuOpen } = useMobileHeaderMenu()
  const { isAuthenticated, isAuthLoading, profileSummary, profileLoading } = useHeaderAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!userMenuOpen) {
      return
    }
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const el = userMenuRef.current
      if (!el || !(event.target instanceof Node) || el.contains(event.target)) {
        return
      }
      setUserMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown, { passive: true })
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [userMenuOpen])

  const handleLoginClick = () => {
    if (isAuthLoading) {
      return
    }
    setIsMenuOpen(false)
    router.push("/login")
  }

  const handleCreateSkillClick = () => {
    setIsMenuOpen(false)
    if (isAuthenticated) {
      router.push("/create-skill")
      return
    }

    router.push("/login?mode=signup")
  }

  const handleLogoutMenuClick = () => {
    setUserMenuOpen(false)
    setIsMenuOpen(false)
    setShowLogoutConfirm(true)
  }

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false)
  }

  const handleLogoutConfirm = async () => {
    if (isSigningOut) {
      return
    }
    setIsSigningOut(true)
    const { error } = await supabase.auth.signOut()
    if (!error) {
      navigateAfterLogout()
      return
    }
    setIsSigningOut(false)
  }

  return (
    <header
      className={cn(
        fixed
          ? cn(
              "fixed top-0 border-b border-border bg-background dark:bg-background/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-background/80 transform-gpu will-change-transform md:transform-none md:will-change-auto",
              "inset-x-0",
            )
          : "sticky top-0 border-b border-border bg-background dark:bg-background/95 dark:backdrop-blur dark:supports-[backdrop-filter]:bg-background/80 transform-gpu will-change-transform md:transform-none md:will-change-auto",
        /* ボトムナビ（z-50）より手前に出し、メニュー最下段が隠れないようにする */
        isMenuOpen ? "z-[70]" : "z-50",
      )}
    >
      <div className="w-full px-4 md:px-6">
        <div className="flex h-16 min-h-16 items-center justify-between gap-2 sm:gap-3 md:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] sm:h-10 sm:w-10">
              <BrandMarkSvg className="block h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            </div>
            <span className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
              <span className="text-[#e64a19]">Grit</span>
              <span className="text-zinc-950 dark:text-white">Vib</span>
            </span>
          </Link>

          {/* トップなど: スマホ幅でも常に検索窓を表示（横は flex-1 で可変） */}
          {onSearchKeywordChange ? (
            <div className="min-w-0 flex-1 md:max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-3" />
                <Input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="スキルを検索..."
                  value={searchKeyword ?? ""}
                  onChange={(event) => onSearchKeywordChange(event.target.value)}
                  className="h-9 w-full border-border bg-secondary pl-9 pr-2 text-sm focus:border-primary focus:ring-primary sm:h-10 sm:pl-10"
                />
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden="true" />
          )}

          {/* Navigation - Desktop */}
          <nav className="hidden items-center gap-4 md:flex">
            {isAuthLoading ? (
              <Button
                type="button"
                disabled
                aria-busy="true"
                aria-label="読み込み中"
                className="pointer-events-none h-9 min-w-[5.5rem] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
              >
                <span className="opacity-0">教える</span>
              </Button>
            ) : isAuthenticated ? (
              <Button
                type="button"
                onClick={handleCreateSkillClick}
                className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                教える
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreateSkillClick}
                className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                無料でお店をつくる
              </Button>
            )}
            <Link href="/guide" className="text-sm font-medium text-muted-foreground hover:text-primary-readable transition-colors">
              使い方
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              disabled={isAuthLoading}
              aria-label="メニューを開く"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-header-menu"
              className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 md:hidden"
            >
              {isAuthLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </button>
            {isAuthenticated ? (
              <UserMenu
                profileSummary={profileSummary}
                profileLoading={profileLoading}
                isAuthLoading={isAuthLoading}
                open={userMenuOpen}
                onOpenChange={setUserMenuOpen}
                onLogoutRequest={handleLogoutMenuClick}
                menuRef={userMenuRef}
                className="hidden md:block"
              />
            ) : (
              <button
                type="button"
                onClick={handleLoginClick}
                disabled={isAuthLoading}
                aria-label="ログイン"
                className="ml-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 md:ml-3 md:inline-flex"
              >
                {isAuthLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
                ) : (
                  <User className="h-5 w-5" aria-hidden />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <MobileHeaderMenuDrawer
        portalReady={portalReady}
        onLogoutRequest={handleLogoutMenuClick}
        onLoginRequest={handleLoginClick}
      />

      {portalReady &&
        showLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100svh] w-full items-center justify-center overflow-y-auto bg-black/50 p-4 sm:p-6 md:min-h-screen"
            role="presentation"
            onClick={handleLogoutCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="header-logout-confirm-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="header-logout-confirm-title" className="text-center text-base font-medium leading-relaxed text-foreground">
                ログアウトしてもよろしいですか？
              </h2>
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1 bg-zinc-600 font-medium text-zinc-100 hover:bg-zinc-500"
                  onClick={handleLogoutCancel}
                  disabled={isSigningOut}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-red-600 font-medium text-white hover:bg-red-500"
                  onClick={() => void handleLogoutConfirm()}
                  disabled={isSigningOut}
                >
                  ログアウト
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  )
}
