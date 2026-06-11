import type { Metadata } from "next"
import JapanEntryPrivacyPolicyPage from "@/japan-entry/legal/privacy-policy/page"

const TITLE = "Privacy Policy | Japan Entry Support | GritVib"
const DESCRIPTION =
  "Privacy Policy for GritVib Japan Market Entry Support — how we collect, use, and protect client information."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry/privacy-policy" },
  openGraph: {
    url: "/japan-entry/privacy-policy",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Page() {
  return <JapanEntryPrivacyPolicyPage />
}
