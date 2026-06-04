"use client"

import { Check, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import { Reveal } from "@/landing-preview/_reveal"

/**
 * /landing-preview の "料金プラン" セクション。
 *
 * シングルプラン (1 件 ¥500) を強くアピールする構成。
 * 大きな価格表示と、含まれる内容、強い CTA を中央に配置。
 * カードは表示時にふわっとスケールアップ。
 */

const INCLUDED = [
  "アプリ 1 本に対する実機検証",
  "主要動線 / サブ動線の利用レポート",
  "再現手順付きのバグレポート",
  "Markdown または PDF での納品",
] as const

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-y border-zinc-200 bg-gradient-to-b from-[#fff5f1] via-[#fff9f6] to-[#fff5f1] py-24 dark:border-zinc-800 dark:from-[#1a0e09] dark:via-[#140a06] dark:to-[#1a0e09] md:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[320px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.22),_transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[260px] bg-[radial-gradient(ellipse_at_bottom,_rgba(230,74,25,0.16),_transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 sm:px-6 md:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#e64a19]/40 bg-[#e64a19]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e64a19] sm:text-xs sm:tracking-[0.22em]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Pricing
            </span>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white md:text-4xl">
              シンプル、1 件 ¥500。
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-base">
              月額・サブスク・最低契約なし。気軽に 1 本から、お試しいただけます。
            </p>
          </div>
        </Reveal>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "0px 0px -80px 0px" }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-12 max-w-xl md:mt-16"
        >
          <article className="relative overflow-hidden rounded-3xl border border-[#e64a19]/40 bg-white p-8 shadow-2xl shadow-[#e64a19]/20 dark:bg-[#13131a] md:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#e64a19]/20 blur-3xl"
            />
            <header className="relative text-center">
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#e64a19] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm">
                Single plan
              </span>
              <p className="mt-6 flex items-baseline justify-center gap-1.5 text-zinc-900 dark:text-white">
                <span className="text-2xl font-bold">¥</span>
                <span className="text-7xl font-black tracking-tight md:text-8xl">500</span>
                <span className="ml-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  / 1 件
                </span>
              </p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                税込・アプリ 1 本につき
              </p>
            </header>

            <ul className="relative mt-8 space-y-3 text-sm md:text-base">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e64a19]/15 text-[#e64a19]">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-pretty leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="relative mt-9 flex justify-center">
              <a
                href="#request"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#e64a19] px-8 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(230,74,25,0.7)] transition-all hover:bg-[#ff5a25] hover:shadow-[0_18px_60px_-10px_rgba(230,74,25,0.8)] md:text-base"
              >
                このプランで依頼する
                <motion.span
                  aria-hidden
                  animate={{ x: [0, 4, 0] }}
                  transition={{
                    duration: 1.6,
                    ease: "easeInOut",
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                >
                  →
                </motion.span>
              </a>
            </div>
          </article>
        </motion.div>
      </div>
    </section>
  )
}
