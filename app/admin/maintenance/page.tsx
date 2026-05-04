import type { Metadata } from "next"
import AdminMaintenancePage from "@/admin/maintenance/page"

export const metadata: Metadata = {
  title: "メンテナンス設定",
  description: "GritVib 管理コンソール：メンテナンスモードの切り替え。",
  alternates: { canonical: "/admin/maintenance" },
  openGraph: { url: "/admin/maintenance" },
}

export default function Page() {
  return <AdminMaintenancePage />
}
