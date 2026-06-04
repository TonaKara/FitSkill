"use client"

import { useState } from "react"
import Link from "next/link"
import { LegalFoot } from "@/talk/_legal-foot"

/**
 * GritVib (人間チャットサービス) のサブスク開始画面 (UI スケルトン)。
 *
 * 月額 ¥3,000 の Stripe Checkout に誘導する。Phase 1B で Stripe Checkout セッション
 * 作成 Server Action に接続予定。未払いの状態だとチャット送信は不可。
 */
export function CheckoutPage() {
  const [isStarting, setIsStarting] = useState(false)

  const handleStart = () => {
    setIsStarting(true)
    // Phase 1B で Stripe Checkout セッションを作成して redirect する。
    // 現状はクリック演出のみ。
    window.setTimeout(() => setIsStarting(false), 800)
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-black">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-zinc-500 hover:text-zinc-900"
          >
            GritVib
          </Link>
          <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
            お話を始めるには、サブスクを開始してください。
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">
            月額 ¥3,000 (税込)。
            <br />
            いつでも解約できます。次の更新日以降は請求されません。
          </p>

          <div className="mt-10 rounded-3xl border border-zinc-200 p-8">
            <p className="text-sm font-medium text-zinc-500">GritVib Subscription</p>
            <p className="mt-2 flex items-baseline justify-center gap-1 text-black">
              <span className="text-3xl font-medium">¥</span>
              <span className="text-6xl font-medium tracking-tight">3,000</span>
              <span className="ml-1 text-sm text-zinc-500">/ 月</span>
            </p>
            <ul className="mt-6 space-y-2 text-left text-sm text-zinc-700">
              <li>・人間のスタッフとのチャット</li>
              <li>・回数制限なし</li>
              <li>・通知なし、急かしなし</li>
            </ul>
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {isStarting ? "決済画面を開いています…" : "サブスクを開始する"}
            </button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-zinc-500">
            決済は Stripe を使用しています。クレジットカード情報は当サービスに保存されません。
          </p>
        </div>
      </main>
      <LegalFoot />
    </div>
  )
}
