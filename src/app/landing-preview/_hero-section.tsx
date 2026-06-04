"use client"

import { useEffect, useState } from "react"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react"
import { ClipboardList, FlaskConical, FileCheck2 } from "lucide-react"

/**
 * /landing-preview のヒーローセクション (クライアント側)。
 *
 * シーケンス (同一セクション内で完結):
 *   Phase 0: 真っ黒な舞台に背景の光源だけがそっと現れる。
 *   Phase 1: 「本気のフィードバックを、」が奥から立ち上がる。
 *   Phase 2: 「あなたへ」が奥から立ち上がる (オレンジグラデ)。
 *   Phase 3: 2 行の文字が手前へと拡大 + ブラー + フェードアウトで消える。
 *   Phase 4: 入れ替わりで「依頼の流れ」3 ステップが奥から順に立ち上がる。
 *
 * - 文字側 / 流れ側を `AnimatePresence mode="wait"` で切り替え、
 *   out → in を待ち合わせて滑らかに繋ぐ。
 * - `MotionConfig reducedMotion="user"` で OS 設定を尊重。
 * - useReducedMotion 起因の hydration mismatch を避けるため、Phase 切替は
 *   クライアントマウント後の `setTimeout` で行う。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

/** タイトル: 2 行を順番に立ち上げる */
const titleContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.45,
      staggerChildren: 0.95,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const titleLineVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.35,
    z: -600,
    rotateX: -12,
    filter: "blur(22px)",
  },
  show: {
    opacity: 1,
    scale: 1,
    z: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: { duration: 1.4, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    scale: 1.2,
    z: 220,
    filter: "blur(18px)",
    transition: { duration: 0.8, ease: EASE_OUT_EXPO },
  },
}

/**
 * フロー全体 (3 ステップ → CTA) の "親" container。
 * 直下に置く 2 つの子 (ステップ群 motion / CTA motion) を順に表示する。
 * `staggerChildren` の値は、ステップ群が出揃うまでの所要時間に合わせて
 * 大きめに取り、CTA はステップが立ち上がりきった頃にスタートする。
 *   - ステップ群完了見込み: delayChildren 0.15 + stagger 0.32 * 2 + duration 1.1 ≒ 1.9s
 */
const flowOuterVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.15,
      staggerChildren: 2.0,
    },
  },
}

/** 3 ステップを stagger で順次立ち上げる中段 container */
const flowStepsContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0,
      staggerChildren: 0.32,
    },
  },
}

const flowItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.55,
    z: -380,
    rotateX: -10,
    filter: "blur(14px)",
  },
  show: {
    opacity: 1,
    scale: 1,
    z: 0,
    rotateX: 0,
    filter: "blur(0px)",
    transition: { duration: 1.1, ease: EASE_OUT_EXPO },
  },
}

const STEPS = [
  {
    icon: ClipboardList,
    label: "STEP 01",
    title: "依頼する",
    body: "アプリの URL と見てほしいポイントを送るだけ。受領 1 営業日以内に返信します。",
  },
  {
    icon: FlaskConical,
    label: "STEP 02",
    title: "実機で検証",
    body: "想定ユーザーになりきって、主要動線からサブ動線まで使い込みます。",
  },
  {
    icon: FileCheck2,
    label: "STEP 03",
    title: "レポートを納品",
    body: "良かった点 / 気になった点 / バグ報告を、そのまま使える形でお届け。",
  },
] as const

/**
 * タイトル 2 行の表示が終わってから消え始めるまでの合計時間 (ms)。
 *   - 1 行目 reveal start: 450ms
 *   - 1 行目 reveal end:   450 + 1400 = 1850ms
 *   - 2 行目 reveal start: 450 + 950 = 1400ms
 *   - 2 行目 reveal end:   1400 + 1400 = 2800ms
 *   - 余韻 ~1500ms 置いて切り替え → 4300ms
 */
const PHASE_SWITCH_MS = 4300

export function HeroSection() {
  const [phase, setPhase] = useState<"title" | "flow">("title")

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("flow"), PHASE_SWITCH_MS)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#08080a] text-zinc-100">
        {/* 背景: 上部のオレンジ光源 (ゆっくりフェードイン) */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[-12%] -z-10 h-[640px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.45),_transparent_65%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.8, ease: EASE_OUT_EXPO }}
        />
        {/* 背景: 下部に流れるオレンジオーブ (静かに脈動) */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[-20%] -z-10 h-[520px] bg-[radial-gradient(ellipse_at_bottom,_rgba(230,74,25,0.22),_transparent_70%)] blur-2xl"
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [1, 1.04, 1] }}
          transition={{
            duration: 10,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
        {/* グレインノイズ風レイヤー */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:3px_3px]"
        />

        <div
          className="mx-auto w-full max-w-5xl px-5 sm:px-6 md:px-8"
          style={{ perspective: 1400, transformStyle: "preserve-3d" }}
        >
          <AnimatePresence mode="wait">
            {phase === "title" ? (
              <motion.div
                key="title"
                variants={titleContainerVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-col items-center gap-4 text-center sm:gap-6 md:gap-8"
              >
                <motion.h1
                  variants={titleLineVariants}
                  className="text-balance text-[44px] font-black leading-[1.1] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[88px]"
                >
                  本気のフィードバックを、
                </motion.h1>
                <motion.h1
                  variants={titleLineVariants}
                  className="text-balance text-[44px] font-black leading-[1.1] tracking-tight sm:text-6xl md:text-7xl lg:text-[88px]"
                >
                  <span className="bg-gradient-to-r from-[#ffb796] via-[#ff7a45] to-[#e64a19] bg-clip-text text-transparent">
                    あなたへ
                  </span>
                </motion.h1>
              </motion.div>
            ) : (
              <motion.div
                key="flow"
                variants={flowOuterVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col items-center gap-8 md:gap-10"
              >
                <motion.div
                  variants={flowStepsContainerVariants}
                  className="grid w-full gap-5 md:grid-cols-3 md:gap-6"
                >
                  {STEPS.map((step) => {
                    const Icon = step.icon
                    return (
                      <motion.article
                        key={step.title}
                        variants={flowItemVariants}
                        className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-[#13131a]/80 p-7 shadow-2xl shadow-black/40 backdrop-blur md:p-8"
                      >
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#e64a19]/15 blur-3xl"
                        />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e64a19]/40 bg-[#1a0e09] shadow-[0_0_30px_-8px_rgba(230,74,25,0.6)]">
                          <Icon className="h-5 w-5 text-[#ffb796]" aria-hidden />
                        </div>
                        <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb796]">
                          {step.label}
                        </p>
                        <h2 className="relative mt-2 text-2xl font-bold leading-snug text-white md:text-[28px]">
                          {step.title}
                        </h2>
                        <p className="relative mt-3 text-pretty text-sm leading-relaxed text-zinc-300 md:text-base">
                          {step.body}
                        </p>
                      </motion.article>
                    )
                  })}
                </motion.div>

                <motion.div variants={flowItemVariants}>
                  <a
                    href="#request"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#e64a19] px-8 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(230,74,25,0.7)] transition-all hover:bg-[#ff5a25] hover:shadow-[0_18px_60px_-10px_rgba(230,74,25,0.8)] md:h-14 md:px-10 md:text-base"
                  >
                    依頼する
                    <span aria-hidden>→</span>
                  </a>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </MotionConfig>
  )
}
