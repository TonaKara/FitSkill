import type { Metadata } from "next"
import JapanEntryContactPage from "@/japan-entry/contact/page"

const TITLE = "Talk to us — Japan Entry Support | GritVib"
const DESCRIPTION =
  "Send a message to GritVib's Tokyo team about your Japan launch. Consultations, questions, and project inquiries — usually answered within 1–2 business days."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry/contact" },
  openGraph: {
    url: "/japan-entry/contact",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <JapanEntryContactPage />
}
