"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import { MotionConfig, motion, type Variants } from "motion/react"

/**
 * /japan-entry のヒーローセクション（クライアント側）。
 *
 * デザイン方針:
 * - 欧米プレミアム LP（Linear / Vercel / Stripe など）のリビール感を意識した
 *   「ゆっくり・余白多め・シネマティック」な初回アニメーション。
 * - 透明度 + 下からの translate に加え、軽い blur フィルタを差し込むことで
 *   フォーカスが定まる瞬間を演出。
 * - 見出しのみ微かに scale (0.97 → 1) して "settle in" する余韻を出す。
 * - `<MotionConfig reducedMotion="user">` で OS の「動きを減らす」設定を尊重し、
 *   `useReducedMotion()` を SSR 時に参照することで起こるハイドレーション不整合を回避。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.22,
      delayChildren: 0.25,
    },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.1, ease: EASE_OUT_EXPO },
  },
}

const headlineVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.97, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 1.3, ease: EASE_OUT_EXPO },
  },
}

export function HeroSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.18),_transparent_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-[180px] -z-10 h-[360px] bg-[radial-gradient(ellipse_at_center,_rgba(230,74,25,0.06),_transparent_70%)] blur-2xl"
          aria-hidden
        />
        <motion.div
          initial="hidden"
          animate="show"
          variants={containerVariants}
          className="mx-auto w-full max-w-5xl px-5 py-24 text-center sm:px-6 sm:py-28 md:px-8 md:py-36"
        >
          <motion.span
            variants={itemVariants}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-readable sm:text-xs sm:tracking-[0.18em]"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Built by developers in Tokyo
          </motion.span>
          <motion.h1
            variants={headlineVariants}
            className="mx-auto mt-7 max-w-[18ch] text-balance text-[34px] font-black leading-[1.1] tracking-tight text-foreground sm:max-w-none sm:text-5xl md:text-6xl"
          >
            Instantly gain{" "}
            <span className="whitespace-nowrap text-[#e64a19]">&lsquo;Trust&rsquo;</span>{" "}
            <span className="whitespace-nowrap">in Japan.</span>
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="mx-auto mt-7 max-w-3xl text-pretty text-[15px] font-medium leading-relaxed text-foreground/90 sm:text-lg md:text-xl"
          >
            Japanese users are sensitive to &lsquo;unnatural translation&rsquo; and often
            suspect fraud. Simple automated translation ruins your sales.
          </motion.p>
          <motion.p
            variants={itemVariants}
            className="mx-auto mt-5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base"
          >
            Don&rsquo;t just translate &mdash; localize the vibe. Our team of native
            Japanese developers in Tokyo crafts content with perfect honorifics
            (Keigo) and cultural context that makes users feel secure and choose your brand.
          </motion.p>
          <motion.div
            variants={itemVariants}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="#pricing"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              See pricing
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a
              href="#features"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:bg-muted sm:w-auto"
            >
              How it works
            </a>
          </motion.div>
          <motion.p
            variants={itemVariants}
            className="mt-7 text-pretty text-xs text-muted-foreground"
          >
            No retainers. No production. Just high-quality Japanese text, fast.
          </motion.p>
        </motion.div>
      </section>
    </MotionConfig>
  )
}
