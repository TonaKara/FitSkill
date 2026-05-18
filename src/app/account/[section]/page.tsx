import { Suspense } from "react"
import { notFound } from "next/navigation"
import MypageClient from "@/mypage/MypageClient"
import { isAccountSectionSlug } from "@/lib/store-menu"

type AccountSectionPageProps = {
  params: Promise<{ section: string }>
}

export default async function AccountSectionPage({ params }: AccountSectionPageProps) {
  const { section } = await params
  if (!isAccountSectionSlug(section)) {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <MypageClient />
    </Suspense>
  )
}
