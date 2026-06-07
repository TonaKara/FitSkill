"use client"

import { useState } from "react"
import { useTranslations } from "@/lib/i18n/useI18n"
import { TalkBrandHeader } from "@/talk/_brand-header"
import { LegalFoot } from "@/talk/_legal-foot"

/**
 * GritVib (人間チャットサービス) のサブスク開始画面 (UI スケルトン)。
 *
 * 月額料金はロケールに応じて ¥3,000 / $30 を表示する。
 * Phase 1B で Stripe Checkout セッション作成 Server Action に接続予定。未払いの状態だとチャット送信は不可。
 */
export function CheckoutPage() {
  const t = useTranslations("talk.checkout")
  const [isStarting, setIsStarting] = useState(false)

  const handleStart = () => {
    setIsStarting(true)
    window.setTimeout(() => setIsStarting(false), 800)
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-black">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <TalkBrandHeader />
          <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
            {t("heading")}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">
            {t("priceLine")}
            <br />
            {t("cancelAnytime")}
          </p>

          <div className="mt-10 rounded-3xl border border-zinc-200 p-8">
            <p className="text-sm font-medium text-zinc-500">{t("planName")}</p>
            <p className="mt-2 flex items-baseline justify-center gap-1 text-black">
              <span className="text-3xl font-medium">{t("currencySymbol")}</span>
              <span className="text-6xl font-medium tracking-tight">{t("priceAmount")}</span>
              <span className="ml-1 text-sm text-zinc-500">{t("perMonth")}</span>
            </p>
            <ul className="mt-6 space-y-2 text-left text-sm text-zinc-700">
              <li>{t("feature1")}</li>
              <li>{t("feature2")}</li>
              <li>{t("feature3")}</li>
            </ul>
            <button
              type="button"
              onClick={handleStart}
              disabled={isStarting}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
            >
              {isStarting ? t("startingButton") : t("startButton")}
            </button>
          </div>

          <p className="mt-6 text-xs leading-relaxed text-zinc-500">{t("stripeNote")}</p>
        </div>
      </main>
      <LegalFoot />
    </div>
  )
}
