"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react"
import { LegalFoot } from "@/talk/_legal-foot"

/**
 * GritVib (人間チャットサービス) の公開トップ (`/`)。
 *
 * シーケンス (1 セクション内で完結):
 *   Phase 0: 何も無い真っ白な舞台。
 *   Phase 1: 「GritVib」が奥から立ち上がる。
 *   Phase 2: 「人として、」が奥から立ち上がる。
 *   Phase 3: 「生きるということ。」が奥から立ち上がる。
 *   Phase 4: 3 行の文字がふっと手前に拡大しながら消える。
 *   Phase 5: 入れ替わりで 4 行のコピーが順に立ち上がる。
 *   Phase 6: 最後に「はじめる」「ログイン」CTA が立ち上がる。
 *
 * デザイン要件:
 *   - 色は白と黒だけ。アイコン画像なし。
 *   - ヘッダー / フッターなし。極めて静かな佇まい。
 *   - 最下部に小さな法務リンク。
 *   - 右下に「アニメーション」ON/OFF トグル (localStorage に保存)。
 */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

/**
 * タイトル: 3 行を順番に立ち上げる。
 *
 * 元々は親側で `staggerChildren` を使っていたが、PC で「人として、」「生きるということ。」を
 * 1 行に並べる都合上、両者を中間ラッパー <div> で囲む必要が出てきた。
 * stagger は親 motion の "直接の motion 子" にのみ効くため、ラッパーを挟むと
 * 子に伝播しなくなる。そこで、stagger をやめて各行へ個別の `delay` を持たせる
 * factory に切り替えた。
 */
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
 * 表示順:
 *   1. "GritVib"           — 0.35s
 *   2. "人として、"          — 0.35 + 0.9 = 1.25s
 *   3. "生きるということ。"  — 0.35 + 0.9 * 2 = 2.15s
 * 値は元の `delayChildren: 0.35, staggerChildren: 0.9` を保つようにしている。
 */
const titleLineGritVibVariants = makeTitleLineVariants(0.35)
const titleLineFirstVariants = makeTitleLineVariants(1.25)
const titleLineSecondVariants = makeTitleLineVariants(2.15)

/** CTA: 4 行のコピー → 「はじめる」「ログイン」 の順に立ち上げる */
const ctaContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.6,
    },
  },
}

const ctaItemVariants: Variants = {
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
    transition: { duration: 1.05, ease: EASE_OUT_EXPO },
  },
}

/**
 * CTA 末尾の小さな注釈の発火タイミング (cta フェーズ開始からの秒数)。
 *
 *   ctaContainer の `delayChildren: 0.2` + `staggerChildren: 0.6` で各 child が立ち上がる。
 *   注釈は最後 (8 番目) の child なので親の stagger に乗せると 0.2 + 0.6*7 = 4.4s に発火するが、
 *   `transition.delay` を子に書くと stagger 計算と相互作用して読みにくくなり、実際に
 *   「ログインより先に出る」現象を引き起こしていた。
 *
 *   そこで注釈は親の variants 連携から **外し**、フェーズ切替後の絶対経過秒で個別 delay 指定する。
 *
 *   ログイン (= index 6) の発火: 0.2 + 0.6*6 = 3.80s
 *   ログイン完了:                3.80 + 1.05 = 4.85s
 *   注釈はその完了後に少し余韻を置いて出すため 5.0s 後にする。
 */
const CTA_NOTICE_DELAY_SEC = 5.0

/**
 * タイトル 3 行表示が落ち着くまでの合計時間 (ms)。
 *   - 行 1 start: 350ms
 *   - 行 2 start: 350 + 900 = 1250ms
 *   - 行 3 start: 1250 + 900 = 2150ms
 *   - 行 3 end:   2150 + 1350 = 3500ms
 *   - 余韻 ~1200ms 置いて切り替え → 4700ms
 */
const PHASE_SWITCH_MS = 4700

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
}: {
  enabled: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] text-zinc-600 shadow-sm">
      <span id="gritvib-landing-animation-label">アニメーション</span>
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

  const titleLineVariants = animationsEnabled
    ? {
        gritVib: titleLineGritVibVariants,
        first: titleLineFirstVariants,
        second: titleLineSecondVariants,
      }
    : {
        gritVib: instantVariants,
        first: instantVariants,
        second: instantVariants,
      }

  const ctaVariants = animationsEnabled ? ctaItemVariants : instantVariants
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
                  className="mx-auto flex w-full max-w-[18rem] flex-col items-center gap-5 sm:max-w-md md:max-w-4xl md:gap-7"
                >
                  <motion.p
                    variants={titleLineVariants.gritVib}
                    className="text-base font-semibold tracking-tight text-zinc-500 md:text-lg"
                  >
                    GritVib
                  </motion.p>

                  {/*
                    スマホ:
                      - 縦並び。「人として、」を左寄せ・「生きるということ。」を右寄せにして
                        和文の余韻を演出する従来の構成を維持。
                    PC (md 以上):
                      - 横並びにして「人として、生きるということ。」を 1 行で見せる。
                      - 上記の self-start / self-end / text-left / text-right はリセット。
                  */}
                  <motion.h1 className="flex w-full flex-col items-stretch gap-5 md:flex-row md:items-baseline md:justify-center md:gap-3">
                    <motion.span
                      variants={titleLineVariants.first}
                      className="self-start text-left text-4xl font-medium leading-[1.2] tracking-tight md:self-auto md:text-center md:text-6xl"
                    >
                      人として、
                    </motion.span>
                    <motion.span
                      variants={titleLineVariants.second}
                      className="self-end text-right text-4xl font-medium leading-[1.2] tracking-tight md:self-auto md:text-center md:text-6xl"
                    >
                      生きるということ。
                    </motion.span>
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
                  <h1 className="sr-only">人として、生きるということ。| GritVib</h1>
                  {/*
                    1: 最も目立たせる問いかけ。大きく・太く・黒で、視線を最初に確実に集める。
                  */}
                  <motion.p
                    variants={ctaVariants}
                    className="mb-1 text-center text-xl font-semibold leading-snug text-black sm:mb-3 sm:text-2xl md:mb-4 md:text-3xl"
                  >
                    現代に生きる私たちが目指すべき場所は、
                    <br className="md:hidden" />
                    本当に時代の最先端なのか。
                  </motion.p>

                  {/* 2〜4: 補助コピー。落ち着いた zinc-700 で淡々と。 */}
                  <motion.p
                    variants={ctaVariants}
                    className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg"
                  >
                    ここは、ChatGPTの代わりに、人間がチャットの相手をする場所です。
                  </motion.p>
                  <motion.p
                    variants={ctaVariants}
                    className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg"
                  >
                    24時間即レスはしません。
                  </motion.p>
                  <motion.p
                    variants={ctaVariants}
                    className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg"
                  >
                    完璧な回答はしません。
                  </motion.p>
                  <motion.p
                    variants={ctaVariants}
                    className="text-balance text-center text-sm leading-relaxed text-zinc-700 sm:text-base md:text-lg"
                  >
                    対等な立場で話します。
                  </motion.p>

                  {/*
                    5: 控えめに目立たせる結論コピー。
                    短いキメ台詞なので冒頭の問いに迫るくらいの文字サイズに上げて存在感を確保する。
                  */}
                  <motion.p
                    variants={ctaVariants}
                    className="text-center text-lg font-medium leading-snug text-black sm:text-xl md:text-2xl"
                  >
                    人間だからです。
                  </motion.p>

                  <motion.div variants={ctaVariants} className="mt-2 sm:mt-4">
                    <Link
                      href={startHref}
                      className="inline-flex h-12 w-64 items-center justify-center rounded-full bg-black text-base font-medium text-white transition-colors hover:bg-zinc-800 sm:h-14 sm:w-72"
                    >
                      はじめる
                    </Link>
                  </motion.div>
                  <motion.div variants={ctaVariants}>
                    {isLoggedIn ? (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="inline-flex h-12 w-64 cursor-not-allowed items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-base font-medium text-zinc-400 sm:h-14 sm:w-72"
                      >
                        ログイン済み
                      </button>
                    ) : (
                      <Link
                        href="/talk/login"
                        className="text-base text-zinc-700 underline-offset-4 hover:text-black hover:underline"
                      >
                        ログイン
                      </Link>
                    )}
                  </motion.div>
                  {/*
                    注釈は親 stagger の連鎖から独立させ、絶対 delay でログインの後に出す。
                    `variants` を渡さず direct な initial/animate にしているので、親の
                    `ctaContainerVariants` の hidden/show 切替には引きずられない。
                  */}
                  <motion.p
                    initial={
                      animationsEnabled
                        ? { opacity: 0, y: 4, filter: "blur(4px)" }
                        : false
                    }
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={
                      animationsEnabled
                        ? {
                            duration: 0.7,
                            ease: EASE_OUT_EXPO,
                            delay: CTA_NOTICE_DELAY_SEC,
                          }
                        : { duration: 0 }
                    }
                    className="mt-1 text-center text-[11px] leading-relaxed text-zinc-500 sm:mt-2 sm:text-xs"
                  >
                    ※月額 ¥3,000（税込）のサブスクリプションサービスです。
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
          <div className="flex justify-end px-3 sm:px-5">
            <LandingAnimationToggle
              enabled={animationsEnabled}
              onToggle={handleAnimationToggle}
            />
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}
