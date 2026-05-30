"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Award, ChevronDown, Layers, LogOut, Menu, Plus, Settings, User as UserIcon, X } from "lucide-react"

import { BrandMarkSvg } from "@/components/BrandMarkSvg"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

import {
  useFromHereAuth,
  type FromHereProfile,
  type FromHereStreak,
} from "@/fromhere/_auth-context"
import { resolveFromHereAvatarUrl } from "@/fromhere/_avatar-url"

/**
 * /fromhere 配下で共有する独自ヘッダー。
 *
 * 設計メモ:
 * - 共通サイトヘッダーは `shouldShowSiteHeader` で `/fromhere` を除外し非表示にする。
 * - ロゴは GritVib のブランドを引き継ぎつつ、サブラベル "FromHere" を併記。
 * - 認証状態に応じて右側のアクションを切り替える:
 *    - 未ログイン: サインイン / 新規登録ボタン
 *    - ログイン中: 投稿ボタン（未実装は disabled） + ユーザーメニュー（ドロップダウン）
 * - 共通フッターは `ConditionalFooter` 側で引き続き表示する。
 */
export function FromHereHeader() {
  const t = useTranslations("fromhere.header")
  const tMenu = useTranslations("fromhere.header.userMenu")
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  const { user, profile, loading, signOut, streak, isAdmin } = useFromHereAuth()

  /**
   * pathname の変化に追従して、開いていたモバイルメニューを閉じる。
   * - `useEffect` で setState すると React Compiler の `set-state-in-effect` lint
   *   に引っかかるため、レンダー中の derived state リセットパターンで処理する。
   */
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (mobileOpen) {
      setMobileOpen(false)
    }
  }

  useEffect(() => {
    if (!mobileOpen) {
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      router.replace("/fromhere")
      router.refresh()
    }
  }

  const isAuthed = Boolean(user)
  const hideAuthButtons = loading
  /**
   * 投稿フォームへの遷移先。
   *
   * `useFromHereAuth` の `profile` は `onAuthStateChange` で一時的に null になり得るため、
   * ここで `profile` の有無で URL を分岐させると「プロフィール作成済みなのに onboarding へ
   * 飛ぶ」ケースが起きる。そのため URL は **常に `/fromhere/submit`** に固定し、
   * onboarding への振り分けは submit ページが SSR/CSR で改めて行う方針にする。
   */
  const submitHref = user ? "/fromhere/submit" : "/fromhere/signin"

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
        <Link
          href="/fromhere"
          aria-label={t("ariaLabel")}
          className="flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e64a19] sm:h-10 sm:w-10">
            <BrandMarkSvg className="block h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
          </div>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold tracking-tight sm:text-lg">
              <span className="text-[#e64a19]">Grit</span>
              <span className="text-zinc-950 dark:text-white">Vib</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">
              {t("subLabel")}
            </span>
          </span>
        </Link>

        {/**
         * 「プロダクト」「メーカー」ナビは運営側の管理者ビュー（運営レビュー等の動線）として
         * 用意しているため、一般ユーザーには表示しない。`isAdmin` は SSR で本体
         * `profiles.is_admin` を読み取って初期値が確定する。
         */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {isAdmin ? (
            <>
              <NavLink href="/fromhere" exact pathname={pathname} label={t("nav.products")} />
              <NavLink href="/fromhere/makers" pathname={pathname} label={t("nav.makers")} />
            </>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <LanguageSwitcher variant="compact" />
          </div>

          {hideAuthButtons ? null : isAuthed ? (
            <>
              <Button
                asChild
                type="button"
                className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href={submitHref}>
                  <Plus className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">{t("nav.submit")}</span>
                </Link>
              </Button>
              <UserMenu
                profile={profile}
                streak={streak}
                email={user?.email ?? null}
                submitHref={submitHref}
                onSignOut={handleSignOut}
                openLabel={tMenu("openLabel")}
                viewProfileLabel={tMenu("viewProfile")}
                submitProductLabel={t("nav.submit")}
                myProductsLabel={tMenu("myProducts")}
                settingsLabel={tMenu("settings")}
                switchToGritvibLabel={tMenu("switchToGritvib")}
                signOutLabel={tMenu("signOut")}
              />
            </>
          ) : (
            <>
              <Button
                asChild
                type="button"
                variant="ghost"
                size="sm"
                className="hidden text-sm text-foreground hover:bg-muted md:inline-flex"
              >
                <Link href="/fromhere/signin">{t("nav.signin")}</Link>
              </Button>
              <Button
                asChild
                type="button"
                className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href="/fromhere/signup">
                  <Plus className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">{t("nav.signup")}</span>
                </Link>
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? t("menuCloseAria") : t("menuOpenAria")}
            aria-expanded={mobileOpen}
            aria-controls="fromhere-mobile-menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted md:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="fromhere-mobile-menu" className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3">
            {isAdmin ? (
              <>
                <MobileNavLink href="/fromhere" pathname={pathname} label={t("nav.products")} exact />
                <MobileNavLink href="/fromhere/makers" pathname={pathname} label={t("nav.makers")} />
              </>
            ) : null}
            {isAuthed ? (
              <>
                <MobileNavLink href={submitHref} pathname={pathname} label={t("nav.submit")} />
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="mt-1 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-4 w-4" aria-hidden />
                    {tMenu("signOut")}
                  </span>
                </button>
              </>
            ) : (
              <>
                <MobileNavLink href="/fromhere/signin" pathname={pathname} label={t("nav.signin")} />
                <MobileNavLink href="/fromhere/signup" pathname={pathname} label={t("nav.signup")} />
              </>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-3">
              <Link
                href="/"
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary-readable"
              >
                ← {t("nav.backToGritvib")}
              </Link>
              <LanguageSwitcher variant="compact" />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

type UserMenuProps = {
  profile: FromHereProfile | null
  streak: FromHereStreak | null
  email: string | null
  submitHref: string
  onSignOut: () => Promise<void> | void
  openLabel: string
  viewProfileLabel: string
  submitProductLabel: string
  myProductsLabel: string
  settingsLabel: string
  switchToGritvibLabel: string
  signOutLabel: string
}

function UserMenu({
  profile,
  streak,
  email,
  submitHref,
  onSignOut,
  openLabel,
  viewProfileLabel,
  submitProductLabel,
  myProductsLabel,
  settingsLabel,
  switchToGritvibLabel,
  signOutLabel,
}: UserMenuProps) {
  const tSidebar = useTranslations("fromhere.sidebar")
  const tMenu = useTranslations("fromhere.header.userMenu")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("mousedown", handleClick)
    window.addEventListener("keydown", handleEsc)
    return () => {
      window.removeEventListener("mousedown", handleClick)
      window.removeEventListener("keydown", handleEsc)
    }
  }, [open])

  /**
   * 未 onboarding（`newvibes_profiles` 行なし）の判定。
   * - true なら「プロフィール未作成」表示にして、メアドフォールバックを抑制する。
   */
  const isOnboardingPending = !profile

  /**
   * イニシャル（文字アバター）。
   * - profile があれば display_name/handle から、無ければ "?" を出す（メアド由来は使わない）。
   */
  const initials = useMemo(() => {
    if (!profile) {
      return "?"
    }
    const source = profile.display_name?.trim() || profile.handle || ""
    const letters = source.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 2).toUpperCase()
    return letters || "?"
  }, [profile])

  /**
   * 表示名。
   * - profile があれば display_name → handle の順。
   * - 未作成なら「プロフィール未作成」（i18n）。メアドにはフォールバックしない。
   */
  const displayName = isOnboardingPending
    ? tMenu("incompleteProfile")
    : profile.display_name || profile.handle || ""
  const handleSuffix = profile?.handle ? `@${profile.handle}` : ""
  const avatarUrl = resolveFromHereAvatarUrl({
    avatarUrl: profile?.avatar_url,
    avatarPath: profile?.avatar_path,
  })

  /**
   * トリガーボタンに表示する「現在バッジ」のラベル。
   * バッジ id を i18n キーに展開し、未獲得 / 未読み込み時は null を返す。
   */
  const currentBadgeLabel =
    streak && streak.currentBadge ? tSidebar(`streakBadge.${streak.currentBadge}`) : null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={openLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 max-w-[14rem] items-center gap-2 rounded-full border border-border bg-background pl-1 pr-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:max-w-[18rem]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-bold text-primary-readable">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 公開URLのアバター
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="max-w-[8rem] truncate text-xs font-semibold text-foreground">
            {displayName || "—"}
          </span>
          {currentBadgeLabel ? (
            <span className="inline-flex max-w-[8rem] items-center gap-0.5 truncate text-[10px] font-medium text-amber-600 dark:text-amber-300">
              <Award className="h-2.5 w-2.5 shrink-0" aria-hidden />
              <span className="truncate">{currentBadgeLabel}</span>
            </span>
          ) : handleSuffix ? (
            <span className="max-w-[8rem] truncate text-[10px] text-muted-foreground">
              {handleSuffix}
            </span>
          ) : null}
        </span>
        {currentBadgeLabel && !displayName ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 sm:hidden">
            <Award className="h-2.5 w-2.5" aria-hidden />
            {streak && streak.currentStreak > 0 ? streak.currentStreak : null}
          </span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card text-sm shadow-lg"
        >
          <div className="border-b border-border bg-muted/40 px-3 py-3">
            <p className="truncate font-semibold text-foreground">{displayName || "—"}</p>
            {handleSuffix ? (
              <p className="truncate text-xs text-muted-foreground">{handleSuffix}</p>
            ) : null}
            {email ? <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p> : null}
            {isOnboardingPending ? (
              <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                {tMenu("incompleteProfileHint")}
              </p>
            ) : null}
            {streak && (streak.currentStreak > 0 || streak.currentBadge) ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {streak.currentBadge ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    <Award className="h-3 w-3" aria-hidden />
                    {tSidebar(`streakBadge.${streak.currentBadge}`)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-300">
                  {streak.currentStreak}
                  {tSidebar("streakDaysUnit")}
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col py-1">
            {/**
             * プロフィールリンク。
             * - profile が取得できていればメーカー公開プロフィールへ。
             * - 未取得 / 未作成なら onboarding へ。テキストは「プロフィールを作成」に切り替える。
             */}
            <Link
              href={profile?.handle ? `/fromhere/u/${profile.handle}` : "/fromhere/onboarding"}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
                isOnboardingPending
                  ? "font-semibold text-primary-readable"
                  : "text-foreground",
              )}
            >
              <UserIcon className="h-4 w-4" aria-hidden />
              {isOnboardingPending ? tMenu("createProfile") : viewProfileLabel}
            </Link>
            <Link
              href={submitHref}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {submitProductLabel}
            </Link>
            {/**
             * マイプロダクト / 設定 は常に表示する。
             * 認証クライアントとサーバーで profile fetch 結果がずれた場合でも、
             * リンクは常に提示し、未 onboarding なら遷移先 page の SSR が
             * `/fromhere/onboarding` にリダイレクトする。
             */}
            <Link
              href="/fromhere/my/products"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Layers className="h-4 w-4" aria-hidden />
              {myProductsLabel}
            </Link>
            <Link
              href="/fromhere/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4" aria-hidden />
              {settingsLabel}
            </Link>
            <Link
              href="/"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" aria-hidden />
              {switchToGritvibLabel}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void onSignOut()
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {signOutLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type NavLinkProps = {
  href: string
  label: string
  pathname: string
  exact?: boolean
  disabled?: boolean
  disabledBadge?: string
}

function NavLink({ href, label, pathname, exact, disabled, disabledBadge }: NavLinkProps) {
  const active = exact
    ? pathname === href || pathname === href.split("#")[0]
    : pathname.startsWith(href.split("#")[0] ?? href)

  if (disabled) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground/60"
        title={disabledBadge}
      >
        {label}
        {disabledBadge ? (
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {disabledBadge}
          </span>
        ) : null}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary-readable"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  )
}

function MobileNavLink({
  href,
  label,
  pathname,
  exact,
  disabled,
  disabledBadge,
}: NavLinkProps) {
  const active = exact ? pathname === href : pathname.startsWith(href)

  if (disabled) {
    return (
      <div className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/60">
        <span>{label}</span>
        {disabledBadge ? (
          <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {disabledBadge}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary-readable"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span>{label}</span>
    </Link>
  )
}
