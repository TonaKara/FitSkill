"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CONTENT_PAGE_MAIN_CLASS } from "@/lib/content-page-layout"
import { cn } from "@/lib/utils"

export default function ContactSuccessPage() {
  return (
    <main className={cn(CONTENT_PAGE_MAIN_CLASS, "flex items-center justify-center")}>
      <Card className="mx-auto w-full max-w-2xl border-border bg-card">
        <CardContent className="space-y-8 px-6 py-10 text-center md:px-10">
          <div className="space-y-5">
            <h1 className="text-3xl font-black tracking-wide text-foreground md:text-4xl">
              送信が完了しました
            </h1>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground md:text-base">
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
    </main>
  )
}
