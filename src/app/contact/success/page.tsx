"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ContactSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12 text-zinc-100">
      <Card className="w-full max-w-2xl border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-8 px-6 py-10 text-center md:px-10">
          <div className="space-y-5">
            <h1 className="text-3xl font-black tracking-wide text-white md:text-4xl">
              送信が完了しました
            </h1>
            <div className="space-y-2 text-sm leading-relaxed text-zinc-300 md:text-base">
              <p>お問い合わせいただきありがとうございます。</p>
              <p>運営が必要だと判断したものにのみ返信させていただきます。</p>
              <p>ご返信までお時間をいただく場合がございます（数日かかる場合があります）。</p>
              <p>あらかじめご了承ください。</p>
            </div>
          </div>

          <Button
            asChild
            className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
          >
            <Link href="/">トップページに戻る</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
