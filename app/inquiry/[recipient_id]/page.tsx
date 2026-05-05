import InquiryChatPage from "@/inquiry/[recipient_id]/page"

type PageProps = {
  params: Promise<{ recipient_id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ params, searchParams }: PageProps) {
  await params
  await searchParams
  return <InquiryChatPage />
}
