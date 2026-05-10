"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Menu, Search, X } from "lucide-react"
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
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"
import { cn } from "@/lib/utils"

type HeaderProps = {
  searchKeyword?: string
  onSearchKeywordChange?: (value: string) => void
}

type ProfileSummary = {
  displayName: string
  avatarUrl: string
}

type MobileMypageMode = "student" | "instructor"
const MOBILE_MYPAGE_MODE_STORAGE_KEY = "mobile_mypage_mode_preference"

type MobileMenuLink = { label: string; href: string }

type MobileMenuGroup = {
  heading: string
  description: string
  items: MobileMenuLink[]
}

/** スマホヘッダーメニュー — マイページ各タブへのリンク（グループは視認性のためのUIのみ） */
const MOBILE_STUDENT_MENU_GROUPS: MobileMenuGroup[] = [
  {
    heading: "お気に入り",
    description: "気になるスキルを保存してすぐに開けます",
    items: [{ label: "お気に入り", href: "/mypage?mode=student&tab=favorites" }],
  },
  {
    heading: "取引・コミュニケーション",
    description: "リクエスト・相談・進行中のレッスン",
    items: [
      { label: "リクエスト", href: "/mypage?mode=student&tab=requests" },
      { label: "相談中の案件", href: "/mypage?mode=student&tab=inquiry" },
      { label: "進行中の取引（受講中）", href: "/mypage?mode=student&tab=learning" },
    ],
  },
  {
    heading: "取引履歴",
    description: "過去のやり取りを一覧で確認",
    items: [{ label: "取引履歴", href: "/mypage?mode=student&tab=transactions" }],
  },
  {
    heading: "プロフィール・アカウント",
    description: "公開プロフィール・アカウント設定など",
    items: [
      { label: "プロフィール設定", href: "/mypage?mode=student&tab=profile" },
      { label: "アカウント設定", href: "/mypage?mode=student&tab=account" },
    ],
  },
]

const MOBILE_INSTRUCTOR_MENU_GROUPS: MobileMenuGroup[] = [
  {
    heading: "出品・売上",
    description: "出品スキル・売上・振込・振込先の管理",
    items: [
      { label: "出品管理", href: "/mypage?mode=instructor&tab=listings" },
      { label: "売上・振込", href: "/mypage?mode=instructor&tab=payout" },
    ],
  },
  {
    heading: "取引・案件",
    description: "リクエストから進行中のレッスンまで",
    items: [
      { label: "リクエスト", href: "/mypage?mode=instructor&tab=requests" },
      { label: "相談", href: "/mypage?mode=instructor&tab=inquiry" },
      { label: "進行中の取引（対応中）", href: "/mypage?mode=instructor&tab=teaching" },
    ],
  },
  {
    heading: "取引履歴",
    description: "過去のやり取りを一覧で確認",
    items: [{ label: "取引履歴", href: "/mypage?mode=instructor&tab=transactions" }],
  },
  {
    heading: "評価・プロフィール",
    description: "評価・公開プロフィール・アカウント設定など",
    items: [
      { label: "評価", href: "/mypage?mode=instructor&tab=reviews" },
      { label: "プロフィール設定", href: "/mypage?mode=instructor&tab=profile" },
      { label: "アカウント設定", href: "/mypage?mode=instructor&tab=account" },
    ],
  },
]

export function Header({ searchKeyword, onSearchKeywordChange }: HeaderProps = {}) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const { isMobileMenuOpen: isMenuOpen, setMobileMenuOpen: setIsMenuOpen } = useMobileHeaderMenu()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const profileFetchUserIdRef = useRef<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileMenuPanelRef = useRef<HTMLDivElement | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const [mobileMypageMode, setMobileMypageMode] = useState<MobileMypageMode>("student")

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const savedMode = window.localStorage.getItem(MOBILE_MYPAGE_MODE_STORAGE_KEY)
    if (savedMode === "student" || savedMode === "instructor") {
      setMobileMypageMode(savedMode)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    window.localStorage.setItem(MOBILE_MYPAGE_MODE_STORAGE_KEY, mobileMypageMode)
  }, [mobileMypageMode])

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
        profileFetchUserIdRef.current = null
        setProfileSummary(null)
        setProfileLoading(false)
        return
      }

      const prevUid = profileFetchUserIdRef.current
      const userIdChanged = prevUid !== user.id
      profileFetchUserIdRef.current = user.id
      if (userIdChanged) {
        setProfileSummary(null)
        setProfileLoading(true)
      }

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

  /** スマホ: メニュー展開中にパネル／ハンバーガー外をタップしたら閉じる */
  useEffect(() => {
    if (!isMenuOpen) {
      return
    }
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
        return
      }
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (mobileMenuButtonRef.current?.contains(target)) {
        return
      }
      if (mobileMenuPanelRef.current?.contains(target)) {
        return
      }
      setIsMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown, { passive: true })
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [isMenuOpen])

  /** スマホ: メニューオーバーレイ表示中は背面スクロールしない */
  useEffect(() => {
    if (!isMenuOpen || typeof document === "undefined") {
      return
    }
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMenuOpen])

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
      profileFetchUserIdRef.current = null
      setProfileSummary(null)
      setProfileLoading(false)
      router.push(getLogoutSuccessHref())
      router.refresh()
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transform-gpu will-change-transform md:transform-none md:will-change-auto",
        /* ボトムナビ（z-50）より手前に出し、メニュー最下段が隠れないようにする */
        isMenuOpen ? "z-[70]" : "z-50",
      )}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 min-h-16 items-center justify-between gap-2 sm:gap-3 md:gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 flex items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#c62828] sm:h-10 sm:w-10">
              <BrandMarkSvg className="block h-8 w-8 shrink-0 text-white sm:h-9 sm:w-9" />
            </div>
            <span className="text-base font-bold tracking-tight sm:text-lg md:text-xl">
              <span className="text-[#c62828]">Grit</span>
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
              ref={mobileMenuButtonRef}
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-controls="header-mobile-menu"
              aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu — fixed オーバーレイ（本文レイアウトを押し下げない） */}
        {isMenuOpen && (
          <div
            ref={mobileMenuPanelRef}
            id="header-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="アカウントメニュー"
            className="fixed inset-x-0 top-16 z-[60] flex h-[calc(100svh-4rem)] max-h-[calc(100svh-4rem)] min-h-0 flex-col md:hidden"
          >
            <button
              type="button"
              aria-label="メニューを閉じる"
              className="min-h-0 flex-1 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="pointer-events-auto max-h-[min(88svh,calc(100svh-4rem))] w-full shrink-0 overflow-hidden rounded-t-2xl border-x border-t border-zinc-800 bg-zinc-950 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]">
              <nav className="relative flex max-h-[min(88svh,calc(100svh-4rem))] flex-col gap-2 overflow-y-auto px-4 pb-[max(2rem,calc(1rem+env(safe-area-inset-bottom)))] pt-4">
                <button
                  type="button"
                  aria-label="メニューを閉じる"
                  className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
                {isAuthenticated ? (
                  <>
                    {profileLoading || profileSummary ? (
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
                    <div className="mb-1 flex w-full rounded-lg border border-zinc-800 bg-zinc-900/80 p-1">
                      <button
                        type="button"
                        onClick={() => setMobileMypageMode("student")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                          mobileMypageMode === "student"
                            ? "bg-red-600 text-white shadow-sm shadow-black/30"
                            : "text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        受講生として利用
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileMypageMode("instructor")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                          mobileMypageMode === "instructor"
                            ? "bg-red-600 text-white shadow-sm shadow-black/30"
                            : "text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        講師として利用
                      </button>
                    </div>
                    <div className="space-y-3 pb-1">
                      {(mobileMypageMode === "student" ? MOBILE_STUDENT_MENU_GROUPS : MOBILE_INSTRUCTOR_MENU_GROUPS).map(
                        (group) => (
                          <section
                            key={group.heading}
                            className="overflow-hidden rounded-xl border-2 border-primary bg-gradient-to-b from-zinc-900/85 to-zinc-950/95 shadow-[0_10px_36px_rgba(0,0,0,0.4)] shadow-primary/15"
                          >
                            <div className="border-b border-primary/35 bg-zinc-900/55 px-3 py-2.5">
                              <h2 className="text-base font-extrabold leading-snug tracking-tight text-primary sm:text-[1.0625rem]">
                                {group.heading}
                              </h2>
                              <p className="mt-1 text-[11px] leading-snug text-zinc-500">{group.description}</p>
                            </div>
                            <ul className="divide-y divide-zinc-800/80">
                              {group.items.map((item) => (
                                <li key={item.href}>
                                  <Link
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className="block px-3 py-2.5 text-[13px] font-medium text-zinc-100 transition-colors hover:bg-zinc-800/90 hover:text-white sm:text-sm"
                                  >
                                    {item.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ),
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleLogoutMenuClick}
                      className="mt-2 w-full bg-red-600 font-semibold text-white hover:bg-red-500"
                    >
                      ログアウト
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={handleLoginClick}
                    disabled={isAuthLoading}
                  >
                    ログイン
                  </Button>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>

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
