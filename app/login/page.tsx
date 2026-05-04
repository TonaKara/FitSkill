import type { Metadata } from "next"
import LoginPage from "@/login/page"

export const metadata: Metadata = {
  title: "ログイン",
  description:
    "GritVib（グリットヴィブ）へのログイン。フィットネス指導スキルの出品・購入は、アカウント作成またはログインのうえでご利用ください。",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
}

export default function Page() {
  return <LoginPage />
}
