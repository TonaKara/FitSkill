"use client"

import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { LegalPageShell } from "@/legal/_shell"
import { getPrivacySections } from "@/lib/legal-content"
import { useLocale, useTranslations } from "@/lib/i18n/useI18n"

export default function PrivacyPolicyPage() {
  const locale = useLocale()
  const tLegal = useTranslations("legal")
  const sections = getPrivacySections(locale)
  const endLabel = tLegal("documentEnd")

  return (
    <LegalPageShell
      title={tLegal("privacyTitle")}
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
