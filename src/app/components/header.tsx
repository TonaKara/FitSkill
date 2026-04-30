"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Dumbbell, Search, User, Menu } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import type { Session } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getLogoutSuccessHref } from "@/components/logout-success-toast"

type HeaderProps = {
  searchKeyword?: string
  onSearchKeywordChange?: (value: string) => void
}

export function Header({ searchKeyword, onSearchKeywordChange }: HeaderProps = {}) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!isMounted) {
        return
      }

      setIsAuthenticated(Boolean(data.user))
      setIsAuthLoading(false)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setIsAuthenticated(Boolean(session?.user))
      setIsAuthLoading(false)
    })

    void loadUser()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleAuthButtonClick = () => {
    if (isAuthLoading || isSigningOut) {
      return
    }

    if (!isAuthenticated) {
      setIsMenuOpen(false)
      router.push("/login")
      return
    }

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
    setIsSigningOut(false)

    if (!error) {
      setIsAuthenticated(false)
      setShowLogoutConfirm(false)
      setIsMenuOpen(false)
      router.push(getLogoutSuccessHref())
      router.refresh()
    }
  }

  const handleCreateSkillClick = () => {
    setIsMenuOpen(false)
    if (isAuthenticated) {
      router.push("/create-skill")
      return
    }

    router.push("/login")
  }

  const handleMyPageClick = () => {
    if (isAuthLoading) {
      return
    }

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    router.push("/mypage")
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 min-h-16 items-center justify-between gap-2 sm:gap-3 md:gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 flex items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary sm:h-10 sm:w-10">
              <Dumbbell className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
            </div>
            <span className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
              <span className="text-primary">Grit</span>
              <span className="text-white">Vib</span>
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
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              スキルを探す
            </Link>
            <button
              type="button"
              onClick={handleCreateSkillClick}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              スキルを出品
            </button>
            <Link href="/guide" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              使い方
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-secondary"
              onClick={handleMyPageClick}
              disabled={isAuthLoading}
            >
              <User className="h-5 w-5" />
            </Button>
            <Button
              className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={handleAuthButtonClick}
              disabled={isAuthLoading || isSigningOut}
            >
              {isAuthenticated ? "ログアウト" : "ログイン"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="border-t border-border py-4 md:hidden">
            <nav className="flex flex-col gap-2">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground"
              >
                スキルを探す
              </Link>
              <button
                type="button"
                onClick={handleCreateSkillClick}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
              >
                スキルを出品
              </button>
              <Link
                href="/guide"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
              >
                使い方
              </Link>
              <Button
                className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={handleAuthButtonClick}
                disabled={isAuthLoading || isSigningOut}
              >
                {isAuthenticated ? "ログアウト" : "ログイン"}
              </Button>
            </nav>
          </div>
        )}
      </div>

      {portalReady &&
        showLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto bg-black/50 p-4 sm:p-6"
            role="presentation"
            onClick={handleLogoutCancel}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="logout-confirm-title"
              className="my-auto w-full max-w-sm shrink-0 rounded-xl border border-border bg-background p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="logout-confirm-title" className="text-center text-base font-medium leading-relaxed text-foreground">
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
