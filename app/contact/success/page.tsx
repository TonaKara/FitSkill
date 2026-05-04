import type { Metadata } from "next"
import ContactSuccessPage from "@/contact/success/page"

export const metadata: Metadata = {
  title: "お問い合わせを受け付けました",
  description: "GritVibへのお問い合わせを受け付けました。内容を確認のうえ、必要に応じてご返信します。",
  alternates: { canonical: "/contact/success" },
  openGraph: { url: "/contact/success" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <ContactSuccessPage />
}
