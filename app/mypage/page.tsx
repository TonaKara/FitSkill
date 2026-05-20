import type { Metadata } from "next"
import MyPage from "@/mypage/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.mypage.title"),
    description: lookupMessage(dict, "metadata.mypage.description"),
    alternates: { canonical: "/mypage" },
    openGraph: { url: "/mypage" },
    robots: { index: false, follow: false },
  }
}

export default function Page() {
  return <MyPage />
}
