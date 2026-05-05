"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Menu, Search } from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Session } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar"
import { getLogoutSuccessHref } from "@/components/logout-success-toast"
import { UserMenu } from "@/components/user-menu"

type HeaderProps = {
  searchKeyword?: string
  onSearchKeywordChange?: (value: string) => void
}

type ProfileSummary = {
  displayName: string
  avatarUrl: string
}

export function Header({ searchKeyword, onSearchKeywordChange }: HeaderProps = {}) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const applyProfileFromRow = (
      row: { display_name: string | null; avatar_url: string | null } | null,
    ): ProfileSummary => {
      const displayNameRaw = typeof row?.display_name === "string" ? row.display_name.trim() : ""
      const label = displayNameRaw.length > 0 ? displayNameRaw : "ユーザー"
      return {
        displayName: label,
        avatarUrl: resolveProfileAvatarUrl(row?.avatar_url ?? null, label),
      }
    }

    const loadSessionAndProfile = async (session: Session | null) => {
      const user = session?.user ?? null
      if (!mounted) {
        return
      }
      setIsAuthenticated(Boolean(user))
      setIsAuthLoading(false)

      if (!user) {
        setProfileSummary(null)
        setProfileLoading(false)
        return
      }

      setProfileLoading(true)
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()

      if (!mounted) {
        return
      }
      setProfileLoading(false)
      setProfileSummary(applyProfileFromRow(data as { display_name: string | null; avatar_url: string | null } | null))
    }

    void supabase.auth.getSession().then(({ data }) => {
      void loadSessionAndProfile(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSessionAndProfile(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

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

    router.push("/login")
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
    setIsSigningOut(false)
    if (!error) {
      setShowLogoutConfirm(false)
      setIsAuthenticated(false)
      setProfileSummary(null)
      router.push(getLogoutSuccessHref())
      router.refresh()
    }
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
              <BrandMarkSvg className="block h-8 w-8 shrink-0 text-primary-foreground sm:h-9 sm:w-9" />
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
            {isAuthenticated ? (
              <div className="hidden md:block">
                <UserMenu
                  profileSummary={profileSummary}
                  profileLoading={profileLoading}
                  isAuthLoading={isAuthLoading}
                  open={userMenuOpen}
                  onOpenChange={setUserMenuOpen}
                  onLogoutRequest={handleLogoutMenuClick}
                  menuRef={userMenuRef}
                />
              </div>
            ) : (
              <Button
                className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={handleLoginClick}
                disabled={isAuthLoading}
              >
                ログイン
              </Button>
            )}
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
              {isAuthenticated && (profileLoading || profileSummary) ? (
                <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2.5">
                  {profileLoading ? (
                    <>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                      </span>
                      <p className="text-xs text-muted-foreground">プロフィールを読み込み中…</p>
                    </>
                  ) : profileSummary ? (
                    <>
                      <div
                        className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center ring-2 ring-border"
                        style={{ backgroundImage: `url(${profileSummary.avatarUrl})` }}
                        role="img"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ログイン中</p>
                        <p className="truncate text-sm font-semibold text-foreground">{profileSummary.displayName}</p>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
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
              {isAuthenticated ? (
                <>
                  <Link
                    href="/mypage"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    マイページ
                  </Link>
                  <Link
                    href="/mypage?tab=profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                  >
                    プロフィール設定
                  </Link>
                  <Button
                    type="button"
                    className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={handleLogoutMenuClick}
                  >
                    ログアウト
                  </Button>
                </>
              ) : (
                <Button
                  className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  onClick={handleLoginClick}
                  disabled={isAuthLoading}
                >
                  ログイン
                </Button>
              )}
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
