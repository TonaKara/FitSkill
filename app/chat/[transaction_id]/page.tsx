import ChatPage from "@/chat/[transaction_id]/page";

type ChatPageProps = {
  params: Promise<{ transaction_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: ChatPageProps) {
  await params;
  await searchParams;
  return <ChatPage />;
}
