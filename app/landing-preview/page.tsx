import type { Metadata } from "next"
import LandingPreviewPage from "@/landing-preview/page"

const TITLE = "GritVib Feedback Lab — あなたのアプリを最初に磨く"
const DESCRIPTION =
  "開発者からの依頼を受けて、実際にアプリを使い込み、利用視点のフィードバックとバグレポートを返します。1 件 ¥500 から。"

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // 仮ルート。検索エンジンには載せず、リンク先からの遷移時のみ動作させる想定。
  robots: { index: false, follow: false },
  alternates: { canonical: "/landing-preview" },
  openGraph: {
    url: "/landing-preview",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default function Page() {
  return <LandingPreviewPage />
}
