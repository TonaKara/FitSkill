"use client"

import { Suspense } from "react"
import { AppNavMenu } from "@/components/layout/AppNavMenu"

function AppSidebarInner() {
  return (
    <aside
      className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex md:min-h-0 md:self-stretch"
      aria-label="メインメニュー"
    >
      <div className="flex min-h-0 flex-1 flex-col px-3 py-5 md:pt-6">
        <AppNavMenu />
      </div>
    </aside>
  )
}

function AppSidebarFallback() {
  return (
    <aside
      className="hidden w-64 shrink-0 border-r border-border bg-background md:block md:min-h-0 md:self-stretch"
      aria-hidden
    />
  )
}

export function AppSidebar() {
  return (
    <Suspense fallback={<AppSidebarFallback />}>
      <AppSidebarInner />
    </Suspense>
  )
}
