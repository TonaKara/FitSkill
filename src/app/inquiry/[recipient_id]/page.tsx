"use client"

import { Suspense } from "react"
import { useTranslations } from "@/lib/i18n/useI18n"
import { InquiryChatClient } from "./InquiryChatClient"

export default function InquiryChatPage() {
  const t = useTranslations("inquiry")
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
          {t("loading")}
        </div>
      }
    >
      <InquiryChatClient />
    </Suspense>
  )
}
