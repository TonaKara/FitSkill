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
 * 欧米プレミアム LP でよく見る「スクロールで段階的に各セクションが立ち上がる」演出を
 * Server Component の page.tsx のまま実現するために、ここだけクライアント側で動作する。
 *
 * - `whileInView` + `viewport={{ once: true }}` で 1 回だけ発火。
 * - グリッド内の各カードを順番に見せたい場合は `delay` を index ベースで渡す。
 * - `MotionConfig reducedMotion="user"` を内包し、OS の「動きを減らす」設定を尊重する。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

interface RevealProps {
  children: ReactNode
  /** 開始までの遅延 (秒)。stagger 用に index * 0.1 などを渡す想定。 */
  delay?: number
  /** 開始位置の下方オフセット (px)。デフォルト 28。 */
  y?: number
  /** アニメーション時間 (秒)。デフォルト 1.0。 */
  duration?: number
  /** 追加 className。グリッドの cell 等で `h-full` を渡したい時に使う。 */
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
