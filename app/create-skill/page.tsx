import type { Metadata } from "next"
import CreateSkillPage from "@/create-skill/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.createSkill.title"),
    description: lookupMessage(dict, "metadata.createSkill.description"),
    alternates: { canonical: "/create-skill" },
    openGraph: { url: "/create-skill" },
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <CreateSkillPage />
}
