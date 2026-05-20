import type { Metadata } from "next"
import ProfileSetupPage from "@/profile-setup/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { tryNotifyNewUserRegistrationDiscordFromSession } from "@/lib/new-user-registration-discord"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.profileSetup.title"),
    description: lookupMessage(dict, "metadata.profileSetup.description"),
    alternates: { canonical: "/profile-setup" },
    openGraph: { url: "/profile-setup" },
    robots: { index: false, follow: false },
  }
}

export default async function Page() {
  await tryNotifyNewUserRegistrationDiscordFromSession()
  return <ProfileSetupPage />
}
