"use client"

import { useEffect, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldRedirectPublicUserToMaintenance } from "@/lib/maintenance-access"

function isMaintenanceGuardSkippedPath(pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return true
  }
  if (pathname === "/maintenance") {
    return true
  }
  if (pathname.startsWith("/_next")) {
    return true
  }
  if (pathname.startsWith("/api")) {
    return true
  }
  if (pathname.includes(".")) {
    return true
  }
  return false
}

/**
 * 公開ページ向け: メンテナンス中かつ管理者でなければ /maintenance へ。
 * 管理画面パスでは何もしない。
 */
export function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  useEffect(() => {
    if (!pathname || isMaintenanceGuardSkippedPath(pathname)) {
      return
    }

    let cancelled = false

    const run = async () => {
      try {
        const block = await shouldRedirectPublicUserToMaintenance(supabase)
        if (cancelled || !block) {
          return
        }
        router.replace("/maintenance")
      } catch (e) {
        console.error("[MaintenanceGuard] メンテナンス判定に失敗しました", e)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [pathname, router, supabase])

  return children
}
