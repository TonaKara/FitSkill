"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { ClipboardList, FlaskConical, FileCheck2 } from "lucide-react"

/**
 * /landing-preview の "依頼の流れ" セクション。
 *
 * 3 ステップ (依頼 → 検証 → 納品) を縦タイムライン状に並べ、
 * スクロール量に応じて中央のオレンジ線が下に伸びるアニメーションを付ける。
 * 各ステップは whileInView でフェードイン。
 */

const STEPS = [
  {
    icon: ClipboardList,
    label: "STEP 01",
    title: "依頼する",
    body: "ページ末尾のフォームから、アプリの URL や見てほしいポイントを送ってください。受領 1 営業日以内に返信します。",
  },
  {
    icon: FlaskConical,
    label: "STEP 02",
    title: "実機で検証",
    body: "ダウンロード〜主要動線〜サブ動線まで、想定ユーザーになりきって 1〜2 日かけて使い込みます。気になった瞬間はすべて記録。",
  },
  {
    icon: FileCheck2,
    label: "STEP 03",
    title: "レポートを納品",
    body: "良かった点 / 気になった点 / 致命的な問題、を整理した報告書を Markdown もしくは PDF でお届けします。",
  },
] as const

export function FlowSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    /**
     * セクション上端がビューポート下端に来た瞬間 (0) から、
     * セクション下端がビューポート中央付近に来た瞬間 (1) まで進捗を取る。
     * 線がスクロールに連動して下に伸びていく演出のためのレンジ。
     */
    offset: ["start end", "end center"],
  })
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"])

  return (
    <section
      id="flow"
      className="relative overflow-hidden bg-[#08080a] py-28 text-zinc-100 md:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.22),_transparent_70%)]"
      />
      <div className="mx-auto w-full max-w-4xl px-5 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -80px 0px" }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#e64a19]/40 bg-[#e64a19]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb796] sm:text-xs sm:tracking-[0.22em]"
          >
            How it works
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -80px 0px" }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-white md:text-4xl"
          >
            3 ステップで、レポートが届きます。
          </motion.h2>
        </div>

        <div ref={containerRef} className="relative mt-16 md:mt-20">
          {/* 背景レール (薄いグレーの縦線) */}
          <div
            aria-hidden
            className="absolute left-6 top-2 bottom-2 w-px bg-zinc-800 md:left-1/2 md:-translate-x-1/2"
          />
          {/* スクロールに連動して伸びるオレンジ線 */}
          <motion.div
            aria-hidden
            style={{ height: lineHeight }}
            className="absolute left-6 top-2 w-px origin-top bg-gradient-to-b from-[#ff7a45] via-[#e64a19] to-transparent md:left-1/2 md:-translate-x-1/2"
          />

          <ul className="space-y-12 md:space-y-20">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isEven = index % 2 === 1
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
                  whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "0px 0px -100px 0px" }}
                  transition={{
                    duration: 1.05,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.1,
                  }}
                  className="relative pl-16 md:flex md:items-center md:gap-10 md:pl-0"
                >
                  {/* タイムライン上のアイコン (左端 or 中央) */}
                  <div className="absolute left-0 top-0 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e64a19]/40 bg-[#1a0e09] shadow-[0_0_30px_-8px_rgba(230,74,25,0.6)] md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2">
                    <Icon className="h-5 w-5 text-[#ffb796]" aria-hidden />
                  </div>

                  {/* カード本体: PC では左右交互配置、SP では右寄せ縦並び */}
                  <div
                    className={[
                      "rounded-2xl border border-zinc-800 bg-[#13131a] p-6 shadow-lg shadow-black/40 md:w-[calc(50%-2.5rem)] md:p-7",
                      isEven ? "md:ml-auto" : "",
                    ].join(" ")}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffb796]">
                      {step.label}
                    </span>
                    <h3 className="mt-2 text-xl font-bold leading-snug text-white md:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-pretty text-sm leading-relaxed text-zinc-300 md:text-base">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
