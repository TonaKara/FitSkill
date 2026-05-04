import type { Metadata } from "next"
import ChatPage from "@/chat/[transaction_id]/page"

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
  return {
    title: "取引チャット",
    description:
      "GritVibの取引に関するメッセージ画面です。購入者と出品者がスキル提供の進行についてやり取りできます。",
    alternates: { canonical: `/chat/${transaction_id}` },
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params, searchParams }: ChatPageProps) {
  await params
  await searchParams
  return <ChatPage />
}
