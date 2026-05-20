"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/useI18n"

export default function ContactSuccessPage() {
  const t = useTranslations("contactSuccess")
  return (
    <main className={cn(CONTENT_PAGE_MAIN_CLASS, "flex items-center justify-center")}>
      <Card className="mx-auto w-full max-w-2xl border-border bg-card">
        <CardContent className="space-y-8 px-6 py-10 text-center md:px-10">
          <div className="space-y-5">
            <h1 className="text-3xl font-black tracking-wide text-foreground md:text-4xl">
              {t("title")}
            </h1>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>{t("thanks")}</p>
              <p>{t("selectiveReply")}</p>
              <p>{t("replyMayTake")}</p>
              <p>{t("acknowledge")}</p>
            </div>
          </div>

          <Button
            asChild
            className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
          >
            <Link href="/">{t("backToHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
