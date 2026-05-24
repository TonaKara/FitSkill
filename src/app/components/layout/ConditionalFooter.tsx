"use client"

import { usePathname } from "next/navigation"
import { Footer } from "@/components/layout/Footer"

export function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null
  }
  /** /japan-entry は英語ランディング独自フッターを内包するため、共通フッターは表示しない */
  if (pathname === "/japan-entry" || pathname.startsWith("/japan-entry/")) {
    return null
  }
  return <Footer />
}
