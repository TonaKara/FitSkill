"use client"

import { ArrowLeft } from "lucide-react"

/**
 * スマホ管理画面用の全画面オーバーレイ。一覧は背面に残し、閉じると一覧へ戻る。
 */
export function MobileAdminSheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-admin-sheet-title"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-black"
          aria-label="閉じる"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p id="mobile-admin-sheet-title" className="truncate text-sm font-medium text-black">
            {title}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
