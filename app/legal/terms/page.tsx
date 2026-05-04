import type { Metadata } from "next"
import TermsPage from "@/legal/terms/page"

export const metadata: Metadata = {
  title: "利用規約",
  description:
    "GritVib（グリットヴィブ）フィットネススキルマーケットの利用条件、禁止事項、取引、決済、免責などを定める利用規約です。",
  alternates: { canonical: "/legal/terms" },
  openGraph: { url: "/legal/terms" },
}

export default function Page() {
  return <TermsPage />
}
