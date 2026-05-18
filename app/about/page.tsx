import type { Metadata } from "next"
import AboutPage from "@/about/page"

export const metadata: Metadata = {
  title: "GritVibについて",
  description:
    "個人の「好き」や「得意」を価値に変える個人ストアプラットフォーム・GritVib（グリットヴィブ）のコンセプト、特徴、安全への取り組みをご紹介します。",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
}

export default function Page() {
  return <AboutPage />
}
