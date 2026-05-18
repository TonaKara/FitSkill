"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { legacyMypageSearchToAccountHref } from "@/lib/store-menu"

/** 旧 `/mypage` URL を `/account/*` へリダイレクト */
export function MypageRedirectClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    router.replace(legacyMypageSearchToAccountHref(searchParams))
  }, [router, searchParams])

  return (
    <div className="flex min-h-[100svh] items-center justify-center md:min-h-screen">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" aria-hidden />
      読み込み中...
    </div>
  )
}
