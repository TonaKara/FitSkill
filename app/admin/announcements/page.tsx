import type { Metadata } from "next"
import AdminAnnouncementsPage from "@/admin/announcements/page"

export const metadata: Metadata = {
  title: "お知らせ管理",
  description: "GritVib 管理コンソール：お知らせの作成と公開。",
  alternates: { canonical: "/admin/announcements" },
  openGraph: { url: "/admin/announcements" },
}

export default function Page() {
  return <AdminAnnouncementsPage />
}
