"use client"

import Link from "next/link"
import { Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"

export default function BannedPage() {
  const t = useTranslations("banned")
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-background/90 px-4 py-8 text-zinc-100">
      <div className="w-full max-w-xl rounded-2xl border border-red-500/40 bg-zinc-950 p-6 shadow-2xl md:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-950/40">
          <Ban className="h-6 w-6 text-red-400" aria-hidden />
        </div>
        <h1 className="text-center text-2xl font-black tracking-wide text-foreground">{t("title")}</h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-zinc-300">
          {t("body")}
        </p>
        <p className="mt-2 text-center text-sm text-zinc-400">
          {t("contactPrefix")}
          <Link href="/contact" className="ml-1 text-red-400 underline underline-offset-2 hover:text-red-300">
            {t("contactLink")}
          </Link>
          {t("contactSuffix")}
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild className="bg-red-600 text-white hover:bg-red-500">
            <Link href="/">{t("backToTop")}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
