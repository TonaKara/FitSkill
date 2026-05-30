"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { adminUi } from "@/lib/admin-ui"
import { cn } from "@/lib/utils"

const ADMIN_TABS = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/products", label: "商品管理" },
  { href: "/admin/transactions", label: "取引一覧" },
  { href: "/admin/announcements", label: "お知らせ" },
  { href: "/admin/reports", label: "通報一覧" },
  { href: "/admin/contacts", label: "問い合わせ一覧" },
  { href: "/admin/disputes", label: "異議申し立て" },
  // FromHere の投稿(プロダクト/ユーザー)を検索し、運営判断で非公開化/BANを行うページ。
  // 「異議申し立て」と「CMS設定」の間に挿入する。
  { href: "/admin/posts", label: "投稿管理" },
  { href: "/admin/cms", label: "CMS設定" },
  { href: "/admin/maintenance", label: "メンテナンス設定" },
] as const

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      const uid = data.user?.id
      if (!uid) {
        router.replace("/")
        return
      }
      const isAdmin = await getIsAdminFromProfile(supabase, uid)
      if (!mounted) {
        return
      }
      if (!isAdmin) {
        router.replace("/")
        return
      }
      setChecking(false)
    })()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" />
        管理者権限を確認中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-8 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-xl border border-border bg-card p-4 md:block">
          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-red-400">管理者</p>
          <Link
            href="/"
            className={cn("mb-3 block rounded-md px-3 py-2 text-sm font-medium transition-colors hover:border-red-500", adminUi.backLink)}
          >
            トップページに戻る
          </Link>
          <nav className="space-y-1">
            {ADMIN_TABS.map((tab) => {
              const active = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-red-600 text-white"
                      : adminUi.navInactive,
                  )}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
