"use client"

import { Bug, Lightbulb, MonitorSmartphone, ScrollText } from "lucide-react"
import { Reveal } from "@/landing-preview/_reveal"

/**
 * /landing-preview の "サービスの全容" セクション。
 *
 * GritVib が依頼を受けたとき具体的に何をするのか、4 つのキーポイントで提示する。
 * Reveal でスクロール連動の段階的な reveal、カードは hover で持ち上がる演出。
 */

const POINTS = [
  {
    icon: MonitorSmartphone,
    title: "実機で、本気で使い込みます",
    body: "iOS / Android / Web、依頼されたアプリを実環境にインストールして、想定ユーザーになりきって動線を一通り触り倒します。",
  },
  {
    icon: Lightbulb,
    title: "利用者視点のフィードバック",
    body: "「ここ迷った」「ここ気持ち良かった」を、開発者には見えにくい温度感のまま言語化して伝えます。",
  },
  {
    icon: Bug,
    title: "バグ・改善点を再現手順付きで",
    body: "見つけた不具合は、端末情報・OS バージョン・再現手順をセットでレポート化。修正に直接使える形に整えてお渡しします。",
  },
  {
    icon: ScrollText,
    title: "そのまま使える報告書",
    body: "良かった点 / 気になった点 / 致命的な問題、を整理した PDF / Markdown レポートで納品。社内共有もそのまま行えます。",
  },
] as const

export function WhatWeDoSection() {
  return (
    <section
      id="what-we-do"
      className="relative border-y border-zinc-200 bg-white py-24 dark:border-zinc-800 dark:bg-[#0c0c10] md:py-32"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 md:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#e64a19]/30 bg-[#e64a19]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e64a19] sm:text-xs sm:tracking-[0.22em]">
              What we do
            </span>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white md:text-4xl">
              依頼を受けて、<br className="sm:hidden" />使い込んで、磨きます。
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
              開発者ひとりではどうしても見えなくなる「初めて触る人の視点」を、丁寧に言語化してお返しします。
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 md:mt-16 md:grid-cols-2 md:gap-6 lg:gap-7">
          {POINTS.map((point, index) => {
            const Icon = point.icon
            return (
              <Reveal key={point.title} delay={0.1 + index * 0.1} className="h-full">
                <article className="group relative h-full overflow-hidden rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#e64a19]/40 hover:shadow-2xl hover:shadow-[#e64a19]/10 dark:border-zinc-800 dark:bg-[#13131a] dark:hover:border-[#e64a19]/50 md:p-8">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#e64a19]/10 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e64a19]/15 text-[#e64a19]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <h3 className="relative mt-5 text-lg font-bold leading-snug text-zinc-900 dark:text-white md:text-xl">
                    {point.title}
                  </h3>
                  <p className="relative mt-3 text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
                    {point.body}
                  </p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
