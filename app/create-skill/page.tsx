import type { Metadata } from "next"
import CreateSkillPage from "@/create-skill/page"

export const metadata: Metadata = {
  title: "スキルを出品",
  description:
    "パーソナルトレーニングやオンラインレッスンなど、フィットネス指導スキルをGritVibに出品するための作成画面です。内容・価格・事前オファー設定までここから登録できます。",
  alternates: { canonical: "/create-skill" },
  openGraph: { url: "/create-skill" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <CreateSkillPage />
}
