import type { Metadata } from "next"
import JapanEntryThankYouPage from "@/japan-entry/thank-you/page"

const TITLE = "Thank you — Japan Entry Support | GritVib"
const DESCRIPTION =
  "Your order has been received. The GritVib team in Tokyo will email you within 24 hours."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/japan-entry/thank-you" },
  openGraph: {
    url: "/japan-entry/thank-you",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  /** 購入後のトランザクション完了画面のため、検索エンジンには載せない */
  robots: { index: false, follow: false },
}

export default function Page() {
  return <JapanEntryThankYouPage />
}
