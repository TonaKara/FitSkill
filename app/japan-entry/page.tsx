import type { Metadata } from "next"
import JapanEntryPage from "@/japan-entry/page"

const TITLE = "Japan Entry Support — Your Bridge to Japan | GritVib"
const DESCRIPTION =
  "Technical localization, legal compliance, and cultural translation for indie creators and global SaaS launching in Japan. Built by developers in Tokyo."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry" },
  openGraph: {
    url: "/japan-entry",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Page() {
  return <JapanEntryPage />
}
