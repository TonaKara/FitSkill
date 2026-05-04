import type { Metadata } from "next"
import ContactPage from "@/contact/page"

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "GritVib（グリットヴィブ）へのご質問・不具合報告・取材などのお問い合わせはこちらから。フィットネススキルマーケットの運営チームが内容を確認します。",
  alternates: { canonical: "/contact" },
  openGraph: { url: "/contact" },
}

export default function Page() {
  return <ContactPage />
}
