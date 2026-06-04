"use client"

import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { LegalPageShell } from "@/legal/_shell"
import { getTermsSections } from "@/lib/legal-content"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

export default function TermsPage() {
  const locale = useLocale()
  const tLegal = useTranslations("legal")
  const sections = getTermsSections(locale)
  const endLabel = tLegal("documentEnd")

  return (
    <LegalPageShell
      title={tLegal("termsTitle")}
      topLinkLabel={tLegal("backToHome")}
    >
      <LegalDocumentContent
        sections={sections}
        className="space-y-6"
        endLabel={endLabel}
        variant="plain"
      />
    </LegalPageShell>
  )
}
