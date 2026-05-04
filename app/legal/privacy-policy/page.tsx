import type { Metadata } from "next"
import PrivacyPolicyPage from "@/legal/privacy-policy/page"

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "GritVib（グリットヴィブ）における個人情報の取扱い、利用目的、第三者提供、Cookieの利用などを定めたプライバシーポリシーです。",
  alternates: { canonical: "/legal/privacy-policy" },
  openGraph: { url: "/legal/privacy-policy" },
}

export default function Page() {
  return <PrivacyPolicyPage />
}
