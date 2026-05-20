"use client"

import Link from "next/link"
import type { RefObject } from "react"
import { Loader2, User } from "lucide-react"
import { ProfileAvatar } from "@/components/profile-avatar"
import { Button } from "@/components/ui/button"
import { STORE_MENU_ITEMS, buildTradesAccountHref, storeMenuItemHref } from "@/lib/store-menu"
import { useTranslations, useTranslationsWithFallback } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

export type UserMenuProfileSummary = {
  displayName: string
  avatarUrl: string | null
}

type UserMenuProps = {
  profileSummary: UserMenuProfileSummary | null
  profileLoading: boolean
  isAuthLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogoutRequest: () => void
  menuRef: RefObject<HTMLDivElement | null>
  className?: string
}

/** ヘッダー右上：人型アイコン。プロフィールカード・ストアメニュー6項目・ログアウト */
export function UserMenu({
  profileSummary,
  profileLoading,
  isAuthLoading,
  open,
  onOpenChange,
  onLogoutRequest,
  menuRef,
  className,
}: UserMenuProps) {
  const tradesHref = buildTradesAccountHref()
  const t = useTranslations("userMenu")
  const tMenuLabel = useTranslationsWithFallback("nav.itemLabels")
  const fallbackName = t("fallbackName")
  // header-auth-context は空文字を返すようになったため、ここで locale 別フォールバックに置き換え
  const rawDisplayName = profileSummary?.displayName ?? ""
  const resolvedDisplayName = rawDisplayName.length > 0 ? rawDisplayName : fallbackName

  return (
    <div ref={menuRef} className={cn("relative ml-2 min-w-0 md:ml-3", className)}>
      <button
        type="button"
        id="header-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="header-user-menu"
        aria-label={t("openMenu")}
        disabled={isAuthLoading}
        onClick={() => onOpenChange(!open)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {profileLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <User className="h-5 w-5" aria-hidden />
        )}
      </button>
      {open ? (
        <div
          id="header-user-menu"
          role="menu"
          aria-labelledby="header-user-menu-trigger"
          className="absolute right-0 top-full z-[60] mt-1 w-[min(calc(100vw-2rem),18rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 py-3">
            {profileLoading ? (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t("loading")}</p>
                </div>
              </>
            ) : (
              <>
                <ProfileAvatar
                  avatarUrl={profileSummary?.avatarUrl ?? null}
                  alt={resolvedDisplayName}
                  className="h-10 w-10"
                  ringClassName="ring-2 ring-border"
                  sizes="40px"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("loggedInLabel")}</p>
                  <p className="truncate text-sm font-semibold text-foreground" title={resolvedDisplayName}>
                    {resolvedDisplayName}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="py-1">
            {STORE_MENU_ITEMS.map((item) => {
              const Icon = item.icon
              const href = storeMenuItemHref(item, tradesHref)
              return (
                <Link
                  key={item.slug}
                  role="menuitem"
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary"
                  onClick={() => onOpenChange(false)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {tMenuLabel(item.slug, item.label)}
                </Link>
              )
            })}
          </div>
          <div className="border-t border-border p-2">
            <Button
              type="button"
              role="menuitem"
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={onLogoutRequest}
            >
              {t("logout")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
