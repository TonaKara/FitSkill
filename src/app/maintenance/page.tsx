"use client"

import { useTranslations } from "@/lib/i18n/useI18n"

export default function MaintenancePage() {
  const t = useTranslations("maintenance")
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-zinc-100">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-3xl font-black text-white">{t("title")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          {t("message")}
        </p>
      </div>
    </div>
  )
}
