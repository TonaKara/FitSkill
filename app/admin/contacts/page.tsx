import type { Metadata } from "next"
import AdminContactsPage from "@/admin/contacts/page"

export const metadata: Metadata = {
  title: "問い合わせ一覧",
  description: "GritVib 管理コンソール：お問い合わせの一覧と対応。",
  alternates: { canonical: "/admin/contacts" },
  openGraph: { url: "/admin/contacts" },
}

export default function Page() {
  return <AdminContactsPage />
}
