import type { Metadata } from "next"
import ProfileSetupPage from "@/profile-setup/page"
import { tryNotifyNewUserRegistrationDiscordFromSession } from "@/lib/new-user-registration-discord"

export const metadata: Metadata = {
  title: "プロフィール設定",
  description:
    "GritVibでスキルを出品・購入する前に、表示名や自己紹介などの公開プロフィールを設定します。",
  alternates: { canonical: "/profile-setup" },
  openGraph: { url: "/profile-setup" },
  robots: { index: false, follow: false },
}

export default async function Page() {
  await tryNotifyNewUserRegistrationDiscordFromSession()
  return <ProfileSetupPage />
}
