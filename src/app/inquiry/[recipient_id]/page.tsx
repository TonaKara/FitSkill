import { Suspense } from "react"
import { InquiryChatClient } from "./InquiryChatClient"

export default function InquiryChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
          読み込み中...
        </div>
      }
    >
      <InquiryChatClient />
    </Suspense>
  )
}
