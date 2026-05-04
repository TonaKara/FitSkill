import type { Metadata } from "next"
import AdminUsersPage from "@/admin/users/page"

export const metadata: Metadata = {
  title: "ユーザー管理",
  description: "GritVib 管理コンソール：ユーザー一覧と操作。",
  alternates: { canonical: "/admin/users" },
  openGraph: { url: "/admin/users" },
}

export default function Page() {
  return <AdminUsersPage />
}
