import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ChevronDown } from "lucide-react"

import { fetchAllPublishedAdminReviewsWithBody } from "@/fromhere/_admin-reviews-data"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"
import { getSiteUrl } from "@/lib/site-seo"

const siteBase = getSiteUrl().replace(/\/$/, "")

/**
 * /fromhere/reviews — 編集部によるレビューの一覧ページ。
 *
 * 設計メモ:
 * - 公開済みの運営レビューを全件 (最大 200) 取得し、ネイティブ `<details>` を使った
 *   アコーディオン UI で本文をその場で展開できるようにする。
 * - 詳細ページ (`/fromhere/reviews/[slug]`) への遷移リンクは設けない方針。
 *   本文はアコーディオン内で読み切れるため、画面遷移を増やさず一覧で完結する。
 * - 本文は管理画面で入力されたテキストをそのまま反映 (改行・空行・連続スペースを
 *   `whitespace-pre-wrap` で保持)。
 * - `<details>` を使うことで JS なしでも開閉でき、デフォルトは閉じた状態。
 * - 公開日 (`publishedAt`) 降順で並ぶ。
 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.reviewsIndex.metaTitle")
  const description = lookupMessage(dict, "fromhere.reviewsIndex.metaDescription")
  /**
   * OGP / Twitter Card 画像は本体トップ (`/`) と完全に同じ `public/og-home.png` を
   * 絶対 URL で指定する。クローラ側でも画像 URL がトップと一致するので、
   * キャッシュも共有されシェア時の見た目が完全に揃う。
   */
  const ogImage = {
    url: `${siteBase}/og-home.png`,
    width: 1200,
    height: 630,
    alt: title,
  } as const
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/reviews" },
    openGraph: {
      url: `${siteBase}/fromhere/reviews`,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  }
}

export default async function Page() {
  const reviews = await fetchAllPublishedAdminReviewsWithBody()
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const titleLabel = lookupMessage(dict, "fromhere.reviewsIndex.title")
  const subtitleLabel = lookupMessage(dict, "fromhere.reviewsIndex.subtitle")
  const emptyLabel = lookupMessage(dict, "fromhere.reviewsIndex.empty")
  const backLabel = lookupMessage(dict, "fromhere.reviewsIndex.back")
  const countTemplate = lookupMessage(dict, "fromhere.reviewsIndex.count")
  const countLabel = countTemplate.replace("{count}", String(reviews.length))

  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-3xl px-4 py-8 md:px-8">
      <div className="mb-6">
        <Link
          href="/fromhere"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {backLabel}
        </Link>
      </div>

      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">
          {titleLabel}
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">{subtitleLabel}</p>
        {reviews.length > 0 ? (
          <p className="text-xs text-muted-foreground">{countLabel}</p>
        ) : null}
      </header>

      {reviews.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const publishedDate = review.publishedAt
              ? new Date(review.publishedAt).toLocaleDateString(
                  locale === "ja" ? "ja-JP" : "en-US",
                )
              : null
            return (
              <li key={review.id}>
                {/**
                 * ネイティブ `<details>` でアコーディオンを実現。
                 * - `summary` がクリッカブルな見出し行。
                 * - 開閉状態はブラウザ標準で管理されるため、JS 不要。
                 * - `[&::-webkit-details-marker]:hidden` で標準のディスクロージャー三角を
                 *   消し、自前の `ChevronDown` をローテーションして表示する。
                 * - `group/details-open:` のような Tailwind プラグインは入れていないので、
                 *   `[&[open]_svg.chevron]:rotate-180` で `open` 属性ベースの回転を行う。
                 */}
                <details className="group rounded-lg border border-border bg-card transition-colors [&[open]]:border-primary/40 [&[open]_svg.chevron]:rotate-180">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                    {review.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開URL
                      <img
                        src={review.iconUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 text-base font-bold text-white"
                        aria-hidden
                      >
                        {review.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-foreground md:text-lg">
                        {review.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground md:text-sm">
                        {review.summary}
                      </p>
                    </div>
                    <ChevronDown
                      className="chevron h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200"
                      aria-hidden
                    />
                  </summary>

                  <div className="border-t border-border px-4 py-4 md:px-6 md:py-5">
                    {/**
                     * 本文。詳細ページと同じく `whitespace-pre-wrap` で管理画面の入力を
                     * 改行・空行・連続スペース込みでそのまま表示する。
                     */}
                    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90 md:text-base">
                      {review.body}
                    </div>
                    {publishedDate ? (
                      <p className="mt-6 text-xs text-muted-foreground">{publishedDate}</p>
                    ) : null}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
