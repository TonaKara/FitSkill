import type { Metadata } from "next"
import SpecifiedCommercialTransactionsPage from "@/legal/specified-commercial-transactions/page"

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記",
  description:
    "GritVib（グリットヴィブ）の特定商取引法に基づく表記。事業者情報、価格、支払方法、返品・キャンセル方針などを掲載しています。",
  alternates: { canonical: "/legal/specified-commercial-transactions" },
  openGraph: { url: "/legal/specified-commercial-transactions" },
}

export default function Page() {
  return <SpecifiedCommercialTransactionsPage />
}
