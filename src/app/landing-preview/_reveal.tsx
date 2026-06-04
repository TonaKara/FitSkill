"use client"

import { MotionConfig, motion } from "motion/react"
import { type ReactNode } from "react"

/**
 * `Reveal` は、子要素がビューポートに入ったタイミングで
 *  - 透明度 0 → 1
 *  - 下から y px 上昇
 *  - 軽い blur フィルタ → 0
 * のリビールアニメーションを再生する薄いラッパ。
 *
 * `/landing-preview` 専用に独立コピー。後で gritvib.com トップへ昇格するときに、
 * japan-entry とコンポーネントの依存関係を絡ませないために別ファイルにしている。
 *
 * - `whileInView` + `viewport={{ once: true }}` で 1 回だけ発火。
 * - グリッド内の各カードを順番に見せたい場合は `delay` を index ベースで渡す。
 * - `MotionConfig reducedMotion="user"` を内包し、OS の「動きを減らす」設定を尊重する。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

interface RevealProps {
  children: ReactNode
  delay?: number
  y?: number
  duration?: number
  className?: string
}

export function Reveal({
  children,
  delay = 0,
  y = 28,
  duration = 1.0,
  className,
}: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y, filter: "blur(6px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "0px 0px -80px 0px" }}
        transition={{ duration, ease: EASE_OUT_EXPO, delay }}
        className={className}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
