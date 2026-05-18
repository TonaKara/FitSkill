import type { Metadata } from "next"
import DiscoverSkillsClient from "@/discover/DiscoverSkillsClient"

export const metadata: Metadata = {
  title: "スキルを探す",
  description: "公開中のスキル・サービスを検索・一覧から探せます。",
  alternates: { canonical: "/discover" },
  robots: { index: true, follow: true },
}

export default function DiscoverPage() {
  return <DiscoverSkillsClient />
}
