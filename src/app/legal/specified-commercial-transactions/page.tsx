"use client"

import { CmsSettingsPublicBlock } from "@/components/cms/CmsSettingsPublicBlock"
import { LegalPageShell } from "@/legal/_shell"
import { useTranslations } from "@/lib/i18n/useI18n"

export default function SpecifiedCommercialTransactionsPage() {
  const tLegal = useTranslations("legal")
  return (
    <LegalPageShell
      title={tLegal("commercialTitle")}
      topLinkLabel={tLegal("backToHome")}
    >
      <CmsSettingsPublicBlock mode="full" variant="plain" />
    </LegalPageShell>
  )
}
