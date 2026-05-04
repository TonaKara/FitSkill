import type { Metadata } from "next"
import AboutPage from "@/about/page"

export const metadata: Metadata = {
  title: "GritVibについて",
  description:
    "相談から始まる安心の取引、透明な手数料、ガイドライン遵守など、GritVib（グリットヴィブ）がフィットネススキルマーケットで大切にしている方針をご紹介します。",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
}

export default function Page() {
  return <AboutPage />
}
