import type { Metadata } from "next"
import AccountSectionPage from "@/account/[section]/page"

type PageProps = {
  params: Promise<{ section: string }>
}

const SECTION_TITLES: Record<string, string> = {
  profile: "プロフィール設定",
  sales: "売上の確認",
  trades: "取引・メッセージ",
  favorites: "お気に入り",
  reviews: "評価",
  settings: "設定",
  listings: "出品管理",
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { section } = await params
  const title = SECTION_TITLES[section] ?? "アカウント"
  return {
    title,
    description: `GritVibの${title}画面です。`,
    alternates: { canonical: `/account/${section}` },
    openGraph: { url: `/account/${section}` },
    robots: { index: false, follow: false },
  }
}

export default function Page(props: PageProps) {
  return <AccountSectionPage {...props} />
}
