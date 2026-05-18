import type { Metadata } from "next"
import GuidePage from "@/guide/page"

export const metadata: Metadata = {
  title: "ご利用ガイド",
  description:
    "出品者・購入者それぞれの流れ（Stripe連携、スキル出品、事前オファー、指導開始、完了申請など）を分かりやすくまとめたGritVibのご利用ガイドです。",
  alternates: { canonical: "/guide" },
  openGraph: { url: "/guide" },
}

export default function Page() {
  return <GuidePage />
}
