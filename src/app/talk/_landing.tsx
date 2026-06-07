"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react"
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher"
import { useTranslations } from "@/lib/i18n/useI18n"
import { LegalFoot } from "@/talk/_legal-foot"

const titleServiceNameClassName =
  "whitespace-nowrap break-keep text-[clamp(5rem,min(24vw,28vh),12rem)] font-medium leading-none tracking-tight text-zinc-600"

/**
 * GritVib (人間チャットサービス) の公開トップ (`/`)。
 *
 * シーケンス (1 セクション内で完結):
 *   Phase 0: 何も無い真っ白な舞台。
 *   Phase 1: 運営名 GritVib（常時）＋サービス名 HITO が立ち上がる。
 *   Phase 2: オープニングが消え、CTA コピーが順に立ち上がる。
 *
 * デザイン要件:
 *   - 色は白と黒だけ。アイコン画像なし。
 *   - ヘッダー / フッターなし。極めて静かな佇まい。
 *   - 最下部に小さな法務リンク。
 *   - 右下に「アニメーション」ON/OFF トグル (localStorage に保存)。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

/** オープニングのサービス名（人 / HITO）用。個別 `delay` で立ち上げる。 */
const titleContainerVariants: Variants = {
  hidden: {},
  show: {},
  /**
   * exit は子の variants 経由で行うため、ここでは staggerChildren を消しても問題ない。
   * （0 を指定しても 0 同時なので意味的に同じ。明示性のため記述するが、削っても可。）
   */
  exit: {
    transition: { staggerChildren: 0 },
  },
}

const makeTitleLineVariants = (delay: number): Variants => ({
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
    transition: { duration: 1.35, ease: EASE_OUT_EXPO, delay },
  },
  /**
   * exit: blur / z / rotateX は外し、opacity + 軽い scale のみ。
   *   - 大きな blur のアニメーションは GPU 負荷が高くカクつく原因になる。
   *   - 3D 変換も切ることで合成レイヤを単純化し、フレーム落ちを防ぐ。
   *   - ease は exit に適した穏やかな in-out 系に。
   */
  exit: {
    opacity: 0,
    scale: 1.04,
    transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] },
  },
})

/**
 * 表示順（オープニング）:
 *   - 運営名 GritVib は常時表示
 *   - サービス名 HITO — 0.35s から立ち上がり
 */
const titleServiceNameVariants = makeTitleLineVariants(0.35)

/** CTA: 5 ブロックを順に立ち上げる（ブロック内の行は同時に表示） */
const ctaContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.28,
      staggerChildren: 0.78,
    },
  },
}

const ctaBlockVariants: Variants = {
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
    transition: { duration: 1.2, ease: EASE_OUT_EXPO },
  },
}

/**
 * オープニング（GritVib + サービス名）が落ち着くまでの合計時間 (ms)。
 *   - サービス名 start: 350ms
 *   - サービス名 end:   350 + 1350 = 1700ms
 *   - 余韻 ~1200ms 置いて CTA へ → 2900ms
 */
const PHASE_SWITCH_MS = 2900

/** トップのアニメーション ON/OFF を localStorage に保存するキー。 */
const ANIMATION_STORAGE_KEY = "gritvib.landing.animation"

function readAnimationEnabled(): boolean {
  try {
    const stored = localStorage.getItem(ANIMATION_STORAGE_KEY)
    if (stored === "0" || stored === "false") return false
    return true
  } catch {
    return true
  }
}

function writeAnimationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ANIMATION_STORAGE_KEY, enabled ? "1" : "0")
  } catch {
    /* private mode 等では無視 */
  }
}

/** アニメーション OFF 時は即時表示用の variants (見た目だけ最終状態)。 */
const instantVariants: Variants = {
  hidden: { opacity: 1, scale: 1, filter: "blur(0px)" },
  show: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0 } },
  exit: { opacity: 1, scale: 1, transition: { duration: 0 } },
}

function LandingAnimationToggle({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean
  onToggle: (next: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 shadow-sm">
      <span id="gritvib-landing-animation-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="gritvib-landing-animation-label"
        onClick={() => onToggle(!enabled)}
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          enabled ? "border-black bg-black" : "border-zinc-300 bg-zinc-100",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  )
}

export function TalkLandingPage({
  startHref = "/talk/register",
  isLoggedIn = false,
}: {
  /** 未ログイン時は `/talk/register`。ログイン済みならサーバーが `/talk/chat` 等を渡す。 */
  startHref?: string
  /** ログイン済みのとき「ログイン」を「ログイン済み」（非活性）にする。 */
  isLoggedIn?: boolean
}) {
  const [phase, setPhase] = useState<"title" | "cta">("title")
  /** 初回は ON 扱い。マウント後に localStorage を読み、OFF なら CTA を即表示。 */
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [preferenceReady, setPreferenceReady] = useState(false)
  const t = useTranslations("talk.landing")
  useEffect(() => {
    const enabled = readAnimationEnabled()
    setAnimationsEnabled(enabled)
    if (!enabled) setPhase("cta")
    setPreferenceReady(true)
  }, [])

  useEffect(() => {
    if (!preferenceReady || !animationsEnabled) return
    setPhase("title")
    const t = window.setTimeout(() => setPhase("cta"), PHASE_SWITCH_MS)
    return () => window.clearTimeout(t)
  }, [preferenceReady, animationsEnabled])

  const handleAnimationToggle = (next: boolean) => {
    setAnimationsEnabled(next)
    writeAnimationEnabled(next)
    if (next) {
      setPhase("title")
    } else {
      setPhase("cta")
    }
  }

  const titleServiceNameMotion = animationsEnabled
    ? titleServiceNameVariants
    : instantVariants

  const ctaVariants = animationsEnabled ? ctaBlockVariants : instantVariants
  const showTitlePhase = animationsEnabled && phase === "title"

  return (
    <MotionConfig reducedMotion={animationsEnabled ? "user" : "always"}>
      {/*
        スクロールを発生させず 1 画面に完結させたいので、
        ルートに `h-[100svh] overflow-hidden` を当てて高さを固定し、
        main 側は `min-h-0` で flex の縮みを許可する。
        `svh` を使うのは、モバイル Safari の URL バー有無で画面高が変わっても
        コンテンツが見切れないようにするため。
      */}
      <div className="flex h-[100svh] flex-col overflow-hidden bg-white text-black">
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-3 py-2 text-center sm:px-5 sm:py-10">
          <div
            style={{ perspective: 1400, transformStyle: "preserve-3d" }}
            className="w-full"
          >
            {!preferenceReady ? (
              <div className="h-px w-full" aria-hidden />
            ) : (
            <AnimatePresence mode="wait">
              {showTitlePhase ? (
                <motion.div
                  key="title"
                  variants={titleContainerVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="mx-auto flex w-full flex-col items-center gap-6 sm:gap-8 md:gap-10"
                >
                  <p className="text-base font-semibold tracking-tight text-zinc-500 md:text-lg">
                    {t("titleBrand")}
                  </p>
                  <motion.h1
                    variants={titleServiceNameMotion}
                    className={titleServiceNameClassName}
                  >
                    {t("titleServiceName")}
                  </motion.h1>
                </motion.div>
              ) : (
                <motion.div
                  key="cta"
                  variants={animationsEnabled ? ctaContainerVariants : instantVariants}
                  initial={animationsEnabled ? "hidden" : false}
                  animate="show"
                  /**
                   * gap / pt の出し分け:
                   *   スマホは行ごとの間隔 (gap) をしっかり取って窮屈さを解消し、
                   *   そのぶん上 padding (pt) は控えめにして 1 画面に収まる縦寸法を維持する。
                   *   PC では従来どおりやや余裕のある padding でグループを画面下方向に寄せる。
                   */
                  className="mx-auto flex w-full max-w-md flex-col items-center gap-5 pt-4 sm:max-w-lg sm:gap-5 sm:pt-16 md:max-w-5xl md:gap-6 md:pt-20"
                >
                  <h1 className="sr-only">{t("srOnlyTitle")}</h1>

                  <motion.div
                    variants={ctaVariants}
                    className="flex w-full flex-col items-center gap-4"
                  >
                    <p className="text-center text-xl font-semibold leading-snug text-black sm:text-2xl md:text-3xl">
                      {t("headline")}
                    </p>
                    <p className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg">
                      {t("intro")}
                    </p>
                  </motion.div>

                  <motion.div
                    variants={ctaVariants}
                    className="flex w-full flex-col items-center gap-4"
                  >
                    <p className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg">
                      {t("point1")}
                    </p>
                    <p className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg">
                      {t("point2")}
                    </p>
                    <p className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg">
                      {t("point3")}
                    </p>
                  </motion.div>

                  <motion.p
                    variants={ctaVariants}
                    className="text-center text-lg font-medium leading-snug text-black sm:text-xl md:text-2xl"
                  >
                    {t("closing")}
                  </motion.p>

                  <motion.div
                    variants={ctaVariants}
                    className="mt-2 flex w-full flex-col items-center gap-3 sm:mt-4"
                  >
                    <Link
                      href={startHref}
                      className="inline-flex h-12 w-64 items-center justify-center rounded-full bg-black text-base font-medium text-white transition-colors hover:bg-zinc-800 sm:h-14 sm:w-72"
                    >
                      {t("ctaStart")}
                    </Link>
                    {isLoggedIn ? (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex h-12 w-64 cursor-not-allowed items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-base font-medium text-zinc-400 sm:h-14 sm:w-72"
                      >
                        {t("ctaLoggedIn")}
                      </button>
                    ) : (
                      <Link
                        href="/talk/login"
                        className="text-base text-zinc-700 underline-offset-4 hover:text-black hover:underline"
                      >
                        {t("ctaLogin")}
                      </Link>
                    )}
                  </motion.div>

                  <motion.p
                    variants={ctaVariants}
                    className="text-center text-[11px] leading-relaxed text-zinc-500 sm:text-xs"
                  >
                    {t("priceNote")}
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>
            )}
          </div>
        </main>

        {/*
          フッター領域を flex の shrink-0 で確保し、トグルは fixed にしない。
          スマホでは法務リンクや CTA 文言と fixed 要素が重なるため、
          法務リンクの下・右寄せの通常フローに置く。
        */}
        <footer className="relative z-10 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <LegalFoot className="pt-6 pb-2 sm:pt-12 sm:pb-4" />
          <div className="flex flex-wrap items-center justify-end gap-2 px-3 sm:px-5">
            <LanguageSwitcher variant="landing" />
            <LandingAnimationToggle
              enabled={animationsEnabled}
              onToggle={handleAnimationToggle}
              label={t("animation")}
            />
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
