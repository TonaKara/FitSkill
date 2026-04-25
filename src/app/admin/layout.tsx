"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ADMIN_TABS = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/users", label: "ユーザー管理" },
  { href: "/admin/products", label: "商品管理" },
  { href: "/admin/announcements", label: "お知らせ" },
  { href: "/admin/reports", label: "通報一覧" },
  { href: "/admin/contacts", label: "問い合わせ一覧" },
  { href: "/admin/disputes", label: "異議申し立て" },
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
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" />
        管理者権限を確認中...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-8 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:block">
          <p className="mb-3 text-sm font-bold uppercase tracking-wide text-red-400">Admin</p>
          <Link
            href="/"
            className="mb-3 block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-red-500 hover:bg-zinc-800 hover:text-white"
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
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
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
