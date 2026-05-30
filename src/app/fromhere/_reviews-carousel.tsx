"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/useI18n"
import type { AdminReviewListItem } from "@/fromhere/_admin-reviews-data"

type Props = {
  reviews: AdminReviewListItem[]
  /** 1 ページに表示するカード数（既定 5） */
  pageSize?: number
  /** 自動切替の間隔 ms（既定 3000） */
  intervalMs?: number
  /** 管理者かどうか（true の場合、ヘッダーに「管理」リンクを出す） */
  isAdmin?: boolean
}

/**
 * 運営レビューの縦カルーセル。
 *
 * - `reviews` を `pageSize` 件ずつ複数ページに分け、`intervalMs` 毎にループ送り。
 * - フェード + 軽い縦スライドのアニメーションで切替（CSS transition のみ）。
 * - ホバー中（ポインタが乗っている間）は一時停止。
 * - キーボード操作: Tab で各カードにフォーカスでき、Enter で詳細ページへ遷移。
 * - ページ数が 1 以下なら自動切替自体を行わない。
 */
export function ReviewsCarousel({
  reviews,
  pageSize = 5,
  intervalMs = 3000,
  isAdmin = false,
}: Props) {
  const t = useTranslations("fromhere.sidebar")

  /** ページに分割（reviews がない場合は空配列） */
  const pages: AdminReviewListItem[][] = []
  for (let i = 0; i < reviews.length; i += pageSize) {
    pages.push(reviews.slice(i, i + pageSize))
  }

  const [pageIndex, setPageIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (pages.length <= 1 || paused) return
    const id = window.setInterval(() => {
      setPageIndex((prev) => (prev + 1) % pages.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [pages.length, paused, intervalMs])

  /** reviews の数が変わってページ数が縮んだ際は index を範囲内に戻す */
  useEffect(() => {
    if (pageIndex >= pages.length && pages.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 範囲外の index を即時補正する目的
      setPageIndex(0)
    }
  }, [pages.length, pageIndex])

  if (reviews.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-4 text-center text-xs text-muted-foreground"
        role="status"
      >
        <p>{t("reviewEmpty")}</p>
        {isAdmin ? (
          <Link
            href="/fromhere/admin/reviews/new"
            className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary-readable hover:underline"
          >
            {t("reviewManage")}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-live="polite"
    >
      {isAdmin ? (
        <div className="flex justify-end">
          <Link
            href="/fromhere/admin/reviews"
            className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary-readable hover:underline"
          >
            {t("reviewManage")}
            <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : null}

      <div className="relative min-h-[480px]">
        {pages.map((page, idx) => (
          <ul
            key={idx}
            className={cn(
              "absolute inset-0 flex flex-col gap-2.5 transition-all duration-500 ease-out",
              idx === pageIndex
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-2 opacity-0",
            )}
            aria-hidden={idx !== pageIndex}
          >
            {page.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
        ))}
      </div>

      {pages.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {pages.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPageIndex(idx)}
              aria-label={t("reviewGotoPage", { page: idx + 1 })}
              aria-current={idx === pageIndex ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === pageIndex
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/60",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 個別のレビューカード。
 * - デスクトップ版 `ReviewsCarousel` とスマホ版 `MobileReviewsRotator` の両方から
 *   再利用するため export している。
 */
export function ReviewCard({ review }: { review: AdminReviewListItem }) {
  return (
    <Link
      href={`/fromhere/reviews/${review.slug}`}
      /**
       * カード自身は不透明な白 (テーマの `bg-background`) を保つ。
       * 親 (編集部セレクト欄) がアクセントカラーで色付けされていても、
       * カードはくっきり白く浮き上がるよう `/60` の透過は使わない。
       * hover 時は border の強調のみ。
       */
      className="group flex gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40"
    >
      {review.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開URL
        <img
          src={review.iconUrl}
          alt=""
          /**
           * 画像にはあえて border を付けず、`object-cover` + `rounded-md` で
           * 画像自身が枠ぴったりに表示されるようにする (二重枠防止)。
           */
          className="h-14 w-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-rose-500 text-base font-bold text-white"
          aria-hidden
        >
          {review.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground group-hover:text-primary-readable">
          {review.title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {review.summary}
        </p>
      </div>
    </Link>
  )
}

type MobileReviewsRotatorProps = {
  reviews: AdminReviewListItem[]
  /** 自動切替の間隔 ms。デスクトップ版と揃えて既定 3000ms。 */
  intervalMs?: number
  /** 表示する最大件数（既定 15）。 */
  maxItems?: number
}

/**
 * スマホ向けの「編集部セレクト」横スライドカルーセル。
 *
 * 仕様:
 * - 1 件ずつ表示し、`intervalMs` (既定 3000ms) ごとに右から左へスライドする。
 * - 2 件以上のときだけ自動切替を行う。1 件のときは固定表示。
 * - 表示対象は最大 `maxItems` (既定 15) 件まで。
 * - `translate-x` + `transition` の純 CSS アニメーションで実装し、JS 計算は index 管理だけ。
 * - タップ中（ポインタがホバー / フォーカス）は一時停止して、ユーザーが目で追える余裕を残す。
 * - インジケータドットを最大 15 個まで表示。10 件超は密度が上がるので幅を細めに調整。
 *
 * デスクトップ版 (`ReviewsCarousel`) との違い:
 * - こちらは 1 件横スライド、向こうは 5 件 1 ページ縦スライド。
 * - 共通の `ReviewCard` を再利用するため、見た目の一貫性は保たれる。
 */
export function MobileReviewsRotator({
  reviews,
  intervalMs = 3000,
  maxItems = 15,
}: MobileReviewsRotatorProps) {
  const visible = reviews.slice(0, maxItems)
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (visible.length <= 1 || paused) return
    const id = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % visible.length)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [visible.length, paused, intervalMs])

  /** reviews 数が変わって表示中 index が範囲外になった場合の補正 */
  useEffect(() => {
    if (idx >= visible.length && visible.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 範囲外 index を即時補正
      setIdx(0)
    }
  }, [visible.length, idx])

  if (visible.length === 0) {
    return null
  }

  return (
    <div
      className="w-full"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-live="polite"
    >
      <div className="overflow-hidden">
        <ul
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {visible.map((review) => (
            <li
              key={review.id}
              className="w-full shrink-0"
              aria-hidden={visible[idx]?.id !== review.id}
            >
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>
      {visible.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
          {visible.map((_, i) => (
            <span
              key={i}
              aria-current={i === idx ? "true" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === idx ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
