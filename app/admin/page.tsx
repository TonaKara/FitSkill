import type { Metadata } from "next"
import AdminDashboardPage from "@/admin/page"

export const metadata: Metadata = {
  title: "管理ダッシュボード",
  description: "GritVib 運営向け管理コンソールのトップです。",
  alternates: { canonical: "/admin" },
  openGraph: { url: "/admin" },
}

export default function Page() {
  return <AdminDashboardPage />
}
