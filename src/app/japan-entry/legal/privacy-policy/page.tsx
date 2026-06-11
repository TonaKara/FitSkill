"use client"

import { LegalDocumentContent } from "@/components/LegalDocumentContent"
import { JapanEntryLegalShell } from "@/japan-entry/legal/_shell"
import { getJapanEntryPrivacySections } from "@/lib/japan-entry/legal-content"

export default function JapanEntryPrivacyPolicyPage() {
  const sections = getJapanEntryPrivacySections()

  return (
    <JapanEntryLegalShell title="Privacy Policy">
      <LegalDocumentContent sections={sections} className="space-y-8" variant="default" />
    </JapanEntryLegalShell>
  )
}
