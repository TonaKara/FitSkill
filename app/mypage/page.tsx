import type { Metadata } from "next"
import MyPage from "@/mypage/page"

export const metadata: Metadata = {
  title: "マイページ",
  description:
    "GritVibのマイページ。出品スキル、取引、Stripe連携、通知など、アカウントに関する操作はこちらから行えます。",
  alternates: { canonical: "/mypage" },
  openGraph: { url: "/mypage" },
  robots: { index: false, follow: false },
}

export default function Page() {
  return <MyPage />
}
