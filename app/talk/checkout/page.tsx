import type { Metadata } from "next"
import { CheckoutPage } from "@/talk/_checkout"

export const metadata: Metadata = {
  title: { absolute: "サブスクを開始 | GritVib" },
  alternates: { canonical: "/talk/checkout" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <CheckoutPage />
}
