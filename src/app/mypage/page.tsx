import { Suspense } from "react"
import MypageClient from "./MypageClient"

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MypageClient />
    </Suspense>
  )
}
