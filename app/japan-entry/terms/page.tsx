import type { Metadata } from "next"
import JapanEntryTermsPage from "@/japan-entry/legal/terms/page"

const TITLE = "Terms of Service | Japan Entry Support | GritVib"
const DESCRIPTION =
  "Terms of Service for GritVib Japan Market Entry Support — translation, cultural adaptation, and subscription SMM services for foreign businesses entering Japan."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry/terms" },
  openGraph: {
    url: "/japan-entry/terms",
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
  return <JapanEntryTermsPage />
}
