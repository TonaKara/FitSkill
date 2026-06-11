"use client"

import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { JapanEntryLegalShell } from "@/japan-entry/legal/_shell"
import { getJapanEntryTermsSections } from "@/lib/japan-entry/legal-content"

export default function JapanEntryTermsPage() {
  const sections = getJapanEntryTermsSections()

  return (
    <JapanEntryLegalShell title="Terms of Service">
      <LegalDocumentContent sections={sections} className="space-y-8" variant="default" />
    </JapanEntryLegalShell>
  )
}
