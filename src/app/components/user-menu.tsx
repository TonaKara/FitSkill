"use client"

import Link from "next/link"
import type { RefObject } from "react"
import { Loader2, User } from "lucide-react"
import { Button } from "@/components/ui/button"

export type UserMenuProfileSummary = {
  displayName: string
  avatarUrl: string
}

type UserMenuProps = {
  profileSummary: UserMenuProfileSummary | null
  profileLoading: boolean
  isAuthLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogoutRequest: () => void
  menuRef: RefObject<HTMLDivElement | null>
}

/** ヘッダー右上：人型アイコンのみ表示。クリックでプロフィール確認・ナビ・ログアウトのドロップダウン */
export function UserMenu({
  profileSummary,
  profileLoading,
  isAuthLoading,
  open,
  onOpenChange,
  onLogoutRequest,
  menuRef,
}: UserMenuProps) {
  return (
    <div ref={menuRef} className="relative ml-2 min-w-0 md:ml-3">
      <button
        type="button"
        id="header-user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="header-user-menu"
        aria-label="アカウントメニューを開く"
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
          className="absolute right-0 top-full z-[60] mt-1 w-[min(calc(100vw-2rem),16rem)] overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
        >
          <div className="flex items-center gap-3 border-b border-border px-3 py-3">
            {profileLoading ? (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">読み込み中…</p>
                </div>
              </>
            ) : (
              <>
                <div
                  className="h-10 w-10 shrink-0 rounded-full bg-cover bg-center ring-2 ring-border"
                  style={{
                    backgroundImage: profileSummary ? `url(${profileSummary.avatarUrl})` : undefined,
                  }}
                  role="img"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">ログイン中</p>
                  <p className="truncate text-sm font-semibold text-foreground" title={profileSummary?.displayName ?? "ユーザー"}>
                    {profileSummary?.displayName ?? "ユーザー"}
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="py-1">
            <Link
              role="menuitem"
              href="/mypage"
              className="block px-3 py-2 text-sm text-foreground hover:bg-secondary"
              onClick={() => onOpenChange(false)}
            >
              マイページ
            </Link>
            <Link
              role="menuitem"
              href="/mypage?tab=profile"
              className="block px-3 py-2 text-sm text-foreground hover:bg-secondary"
              onClick={() => onOpenChange(false)}
            >
              プロフィール設定
            </Link>
          </div>
          <div className="border-t border-border p-2">
            <Button
              type="button"
              role="menuitem"
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={onLogoutRequest}
            >
              ログアウト
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
