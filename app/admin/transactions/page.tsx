import type { Metadata } from "next"
import AdminTransactionsPage from "@/admin/transactions/page"

export const metadata: Metadata = {
  title: "取引一覧",
  description: "GritVib 管理コンソール：取引の一覧と決済情報の確認。",
  alternates: { canonical: "/admin/transactions" },
  openGraph: { url: "/admin/transactions" },
}

export default function Page() {
  return <AdminTransactionsPage />
}
