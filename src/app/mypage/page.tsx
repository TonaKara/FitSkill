import { Suspense } from "react"
import { MypageRedirectClient } from "./MypageRedirectClient"

export default function MyPage() {
  return (
    <Suspense fallback={null}>
      <MypageRedirectClient />
    </Suspense>
  )
}
