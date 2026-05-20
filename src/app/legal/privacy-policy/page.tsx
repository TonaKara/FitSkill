"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { getPrivacySections } from "@/lib/legal-content"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

export default function PrivacyPolicyPage() {
  const locale = useLocale()
  const tLegal = useTranslations("legal")
  const sections = getPrivacySections(locale)
  const endLabel = tLegal("documentEnd")

  return (
    <main className={CONTENT_PAGE_MAIN_CLASS}>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground md:text-3xl">{tLegal("privacyTitle")}</h1>
        <Button
          asChild
          variant="outline"
          className="border-border bg-muted text-foreground hover:border-primary hover:bg-muted/80"
        >
          <Link href="/">{tLegal("backToHome")}</Link>
        </Button>
      </div>
      <section className="space-y-5 rounded-xl border border-border bg-card p-5 md:p-6">
        <LegalDocumentContent sections={sections} className="space-y-5" endLabel={endLabel} />
      </section>
    </main>
  )
}
