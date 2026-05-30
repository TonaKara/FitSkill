import type { Metadata } from "next"
import AdminPostsPage from "@/admin/posts/page"

export const metadata: Metadata = {
  title: "投稿管理",
  description:
    "GritVib 管理コンソール: FromHere に投稿されたプロダクト・メーカーを検索し、非公開化や BAN を行います。",
  alternates: { canonical: "/admin/posts" },
  openGraph: { url: "/admin/posts" },
}

export default function Page() {
  return <AdminPostsPage />
}
