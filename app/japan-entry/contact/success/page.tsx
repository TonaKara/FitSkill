import type { Metadata } from "next"
import JapanEntryContactSuccessPage from "@/japan-entry/contact/success/page"

const TITLE = "Message received — Japan Entry Support | GritVib"
const DESCRIPTION =
  "Your inquiry to the GritVib Japan Entry Support team has been received."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry/contact/success" },
  openGraph: {
    url: "/japan-entry/contact/success",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <JapanEntryContactSuccessPage />
}
