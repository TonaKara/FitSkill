"use client"

import { Suspense, useEffect } from "react"
import { usePathname } from "next/navigation"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { ProfileAvatar } from "@/components/profile-avatar"
import { AppNavMenu } from "@/components/layout/AppNavMenu"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { useMobileHeaderMenu } from "@/components/mobile-header-menu-context"
import { useHeaderAuth } from "@/lib/header-auth-context"
import { useTranslations } from "@/lib/i18n/useI18n"

type MobileHeaderMenuDrawerProps = {
  portalReady: boolean
  onLogoutRequest: () => void
  onLoginRequest: () => void
}

function MobileHeaderMenuDrawerInner({ onLogoutRequest, onLoginRequest }: Omit<MobileHeaderMenuDrawerProps, "portalReady">) {
  const pathname = usePathname()
  const { isMobileMenuOpen, setMobileMenuOpen } = useMobileHeaderMenu()
  const { isAuthenticated, isAuthLoading, profileSummary, profileLoading } = useHeaderAuth()
  const tHeader = useTranslations("header")
  const tCommon = useTranslations("common")

  const closeMenu = () => setMobileMenuOpen(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname, setMobileMenuOpen])

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isMobileMenuOpen])

  if (!isMobileMenuOpen) {
    return null
  }

  // displayName が空文字（DB 未設定）の場合も locale 別フォールバックへ落とす
  const rawDisplayName = profileSummary?.displayName ?? ""
  const displayName = isAuthenticated
    ? rawDisplayName.length > 0
      ? rawDisplayName
      : tHeader("user")
    : tHeader("guest")
  const avatarUrl = isAuthenticated ? (profileSummary?.avatarUrl ?? null) : null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 top-16 z-[60] bg-black/45 md:hidden"
        aria-label={tHeader("menuClose")}
        onClick={closeMenu}
      />
      <div
        id="mobile-header-menu"
        role="dialog"
        aria-modal="true"
        aria-label={tHeader("menu")}
        className="fixed bottom-0 right-0 top-16 z-[65] flex w-full max-w-sm flex-col border-l border-border bg-background shadow-xl md:hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{tHeader("menu")}</p>
          <button
            type="button"
            onClick={closeMenu}
            aria-label={tCommon("close")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {isAuthLoading || (isAuthenticated && profileLoading) ? (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
              </div>
            </>
          ) : (
            <>
              <ProfileAvatar
                avatarUrl={avatarUrl}
                alt={displayName}
                className="h-10 w-10"
                ringClassName="ring-2 ring-border"
                sizes="40px"
              />
              <div className="min-w-0 flex-1">
                {isAuthenticated ? (
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{tHeader("loggedIn")}</p>
                ) : null}
                <p className="truncate text-sm font-semibold text-foreground" title={displayName}>
                  {displayName}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <AppNavMenu guestMode={!isAuthenticated} onNavigate={closeMenu} />
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <LanguageSwitcher variant="inline" />
        </div>

        <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isAuthenticated ? (
            <Button
              type="button"
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                closeMenu()
                onLogoutRequest()
              }}
            >
              {tHeader("logout")}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              disabled={isAuthLoading}
              onClick={onLoginRequest}
            >
              {tHeader("login")}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

function MobileHeaderMenuDrawerFallback() {
  return null
}

export function MobileHeaderMenuDrawer({ portalReady, onLogoutRequest, onLoginRequest }: MobileHeaderMenuDrawerProps) {
  if (!portalReady) {
    return null
  }

  return createPortal(
    <Suspense fallback={<MobileHeaderMenuDrawerFallback />}>
      <MobileHeaderMenuDrawerInner onLogoutRequest={onLogoutRequest} onLoginRequest={onLoginRequest} />
    </Suspense>,
    document.body,
  )
}
