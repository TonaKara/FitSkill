import type { Metadata } from "next"
import AdminDisputesPage from "@/admin/disputes/page"

export const metadata: Metadata = {
  title: "異議申し立て",
  description: "GritVib 管理コンソール：取引に関する異議申し立ての確認。",
  alternates: { canonical: "/admin/disputes" },
  openGraph: { url: "/admin/disputes" },
}

export default function Page() {
  return <AdminDisputesPage />
}
