import type { Metadata } from "next"
import AdminReportsPage from "@/admin/reports/page"

export const metadata: Metadata = {
  title: "通報一覧",
  description: "GritVib 管理コンソール：ユーザー通報の確認と対応。",
  alternates: { canonical: "/admin/reports" },
  openGraph: { url: "/admin/reports" },
}

export default function Page() {
  return <AdminReportsPage />
}
