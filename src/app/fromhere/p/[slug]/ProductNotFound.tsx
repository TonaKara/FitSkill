"use client"

import Link from "next/link"
import { PackageOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"

/**
 * プロダクト詳細が見つからない／下書きで閲覧権限がないなどのケースで表示する 404 ページ。
 */
export function ProductNotFound() {
  const t = useTranslations("fromhere.detail")
  return (
    <main className="box-border flex min-h-[60vh] w-full items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageOpen className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-foreground">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFoundBody")}</p>
        <Button asChild className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/fromhere">{t("notFoundHome")}</Link>
        </Button>
      </div>
    </main>
  )
}
