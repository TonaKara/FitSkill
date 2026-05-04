import type { Metadata } from "next"
import AdminCmsPage from "@/admin/cms/page"

export const metadata: Metadata = {
  title: "CMS設定",
  description: "GritVib 管理コンソール：サイト表示に関するCMS設定。",
  alternates: { canonical: "/admin/cms" },
  openGraph: { url: "/admin/cms" },
}

export default function Page() {
  return <AdminCmsPage />
}
