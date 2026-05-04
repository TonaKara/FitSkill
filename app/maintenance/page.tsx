import type { Metadata } from "next"
import MaintenancePage from "@/maintenance/page"

export const metadata: Metadata = {
  title: "メンテナンス中",
  description: "GritVibは現在メンテナンス中です。しばらくしてから再度アクセスしてください。",
  alternates: { canonical: "/maintenance" },
  openGraph: { url: "/maintenance" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MaintenancePage />
}
