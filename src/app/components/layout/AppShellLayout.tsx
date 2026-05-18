"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { isAppShellRoute } from "@/lib/app-shell-routes"
import { shouldShowSiteHeader } from "@/lib/site-header-routes"
import { cn } from "@/lib/utils"

type AppShellLayoutProps = {
  children: React.ReactNode
}

/** 固定ヘッダー（h-16）分の上余白 */
export const APP_SHELL_HEADER_OFFSET_CLASS = "pt-16"

export function AppShellLayout({ children }: AppShellLayoutProps) {
  const pathname = usePathname()
  const inAppShell = isAppShellRoute(pathname)
  const headerOffset = shouldShowSiteHeader(pathname) ? APP_SHELL_HEADER_OFFSET_CLASS : ""

  if (inAppShell) {
    return (
      <div className={cn("flex min-w-0 w-full flex-1 flex-col", headerOffset)}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
          <AppSidebar />
          <div className="flex min-w-0 w-full flex-1 flex-col">{children}</div>
        </div>
      </div>
    )
  }

  return <div className={cn("min-w-0 flex-1 flex-col", headerOffset)}>{children}</div>
}
