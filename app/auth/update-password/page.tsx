import type { Metadata } from "next"
import UpdatePasswordPage from "@/auth/update-password/page"

export const metadata: Metadata = {
  title: "パスワード更新",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <UpdatePasswordPage />
}
