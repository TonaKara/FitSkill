import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import MypageClient from "./MypageClient"

function MypageLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
      <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      <p className="mt-3 text-sm text-zinc-400">読み込み中...</p>
    </div>
  )
}

export default function MyPage() {
  return (
    <Suspense fallback={<MypageLoading />}>
      <MypageClient />
    </Suspense>
  )
}
