"use client"

import Link from "next/link"
import { useTranslations } from "@/lib/i18n/useI18n"

/**
 * talk 系画面のブランド表示。サービス名 HITO と運営名 GritVib を分けて示す。
 */
export function TalkBrandHeader({
  variant = "stacked",
}: {
  /** stacked: 認証系。header: チャット画面上部 */
  variant?: "stacked" | "header"
}) {
  const t = useTranslations("talk.landing")

  if (variant === "header") {
    return (
      <Link
        href="/"
        className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-black"
      >
        {t("titleServiceName")}
      </Link>
    )
  }

  return (
    <div className="text-center">
      <p className="text-[11px] font-semibold tracking-tight text-zinc-400">
        {t("titleBrand")}
      </p>
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight text-zinc-500 hover:text-zinc-900"
      >
        {t("titleServiceName")}
      </Link>
    </div>
  )
}
