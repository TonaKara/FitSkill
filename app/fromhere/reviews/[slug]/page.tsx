import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Edit3 } from "lucide-react"

import { fetchPublishedAdminReviewBySlug } from "@/fromhere/_admin-reviews-data"
import { detectIsFromHereAdmin } from "@/lib/fromhere-admin-check"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/**
 * /fromhere/reviews/[slug] — 編集部セレクトのレビュー詳細ページ。
 *
 * ブログ風のシンプルなレイアウト:
 * - ページ全体に外枠 (border/card 背景) は持たず、本文を `<main>` 直下に並べる。
 * - 見出し / 本文の最大幅は `max-w-3xl` (≒ ブログ可読幅) を維持。
 * - 「運営レビュー」バッジは UI 上は表示しない（i18n キー自体は他箇所参照のため残す）。
 */

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const review = await fetchPublishedAdminReviewBySlug(slug)
  if (!review) {
    return { title: "FromHere" }
  }
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const titleTemplate = lookupMessage(dict, "fromhere.reviews.metaTitle")
  const title = titleTemplate.replace("{title}", review.title)
  const description = review.summary
  const canonical = `/fromhere/reviews/${review.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      title,
      description,
      images: review.iconUrl ? [{ url: review.iconUrl }] : undefined,
    },
    twitter: {
      card: review.iconUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  const [review, isAdmin] = await Promise.all([
    fetchPublishedAdminReviewBySlug(slug),
    detectIsFromHereAdmin(),
  ])
  if (!review) {
    notFound()
  }
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const backLabel = lookupMessage(dict, "fromhere.reviews.back")
  const editLabel = lookupMessage(dict, "fromhere.adminReviews.edit")

  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Link
          href="/fromhere"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
        {isAdmin ? (
          <Link
            href={`/fromhere/admin/reviews/${review.id}/edit`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary-readable"
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden />
            {editLabel}
          </Link>
        ) : null}
      </div>

      {/**
       * ブログ風レイアウト:
       *   - `<article>` には外枠 (border/bg-card/角丸/padding) を一切付けず、
       *     `<main>` の余白に直接コンテンツを並べる。
       *   - ヘッダー (アイコン + タイトル + summary) → 区切り線 → 本文 → 公開日 の縦並び。
       *   - 「運営レビュー」バッジは UI から削除。
       */}
      <article>
        <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {review.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開URLのため <img> でよい
            <img
              src={review.iconUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-2xl font-bold text-white shadow-sm"
              aria-hidden
            >
              {review.title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {review.title}
            </h1>
            <p className="mt-3 text-base text-muted-foreground md:text-lg">{review.summary}</p>
          </div>
        </header>

        <hr className="my-8 border-border" />

        {/**
         * 本文表示。
         *
         * - 管理画面 (`AdminReviewForm`) で `<textarea>` に入力された内容を、改行・空行・
         *   連続スペース込みでそのまま表示する (= 入力時の見た目をそのまま反映)。
         * - `whitespace-pre-wrap` で:
         *     - `\n` がそのまま改行になる
         *     - `\n\n` (空行) が空行として表示される
         *     - 連続スペースも折り畳まれず保持される
         *     - 自動折返しは通常通り (ブラウザ幅に応じてラップ)
         * - `break-words` で長い URL 等が画面幅を突き抜けるのを防ぐ。
         * - HTML はパースせず React のテキストノードとして安全に挿入される
         *   (XSS の心配なし)。
         */}
        <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-foreground/90 md:text-lg">
          {review.body}
        </div>

        {review.publishedAt ? (
          <p className="mt-10 text-xs text-muted-foreground">
            {new Date(review.publishedAt).toLocaleString(locale === "ja" ? "ja-JP" : "en-US")}
          </p>
        ) : null}
      </article>
    </main>
  )
}
