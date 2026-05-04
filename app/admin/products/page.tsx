import type { Metadata } from "next"
import AdminProductsPage from "@/admin/products/page"

export const metadata: Metadata = {
  title: "商品管理",
  description: "GritVib 管理コンソール：スキル（商品）の確認と操作。",
  alternates: { canonical: "/admin/products" },
  openGraph: { url: "/admin/products" },
}

export default function Page() {
  return <AdminProductsPage />
}
