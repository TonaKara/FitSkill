"use client"

import { usePathname } from "next/navigation"
import { Footer } from "@/components/layout/Footer"

export function ConditionalFooter() {
  const pathname = usePathname()
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null
  }
  /**
   * GritVib (人間チャットサービス) は極めてシンプルな構成を志向しており、共通フッターは
   * 表示しない。法務リンクは GritVib 側の最下部に独自の極小リンクとして配置している。
   */
  if (pathname === "/") {
    return null
  }
  if (pathname === "/talk" || pathname.startsWith("/talk/")) {
    return null
  }
  if (pathname === "/landing-preview" || pathname.startsWith("/landing-preview/")) {
    return null
  }
  if (pathname === "/japan-entry" || pathname.startsWith("/japan-entry/")) {
    return null
  }
  /**
   * /legal/* は GritVib に揃えた専用シェル (LegalPageShell) を採用しているため、
   * 共通フッターは表示しない。
   */
  if (pathname === "/legal" || pathname.startsWith("/legal/")) {
    return null
  }
  return <Footer />
}
