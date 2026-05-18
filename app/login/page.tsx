import type { Metadata } from "next"
import { Suspense } from "react"
import LoginPage from "@/login/page"

export const metadata: Metadata = {
  title: "ログイン",
  description:
    "GritVib（グリット・ヴィブ）へのログイン。ストアの開設やスキルの出品・購入は、アカウント作成またはログインのうえでご利用ください。",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
