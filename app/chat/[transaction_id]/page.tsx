import type { Metadata } from "next"
import ChatPage from "@/chat/[transaction_id]/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

type ChatPageProps = {
  params: Promise<{ transaction_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ transaction_id: string }>
}): Promise<Metadata> {
  const { transaction_id } = await params
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  return {
    title: lookupMessage(dict, "metadata.chat.title"),
    description: lookupMessage(dict, "metadata.chat.description"),
    alternates: { canonical: `/chat/${transaction_id}` },
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params, searchParams }: ChatPageProps) {
  await params
  await searchParams
  return <ChatPage />
}
