"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Award,
  ArrowRight,
  ArrowUp,
  Flame,
  Hash,
  Lightbulb,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { NotificationToast } from "@/components/ui/notification-toast"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import type { HomeData, HomeProduct } from "@/fromhere/_data"
/**
 * `HOME_RANKING_THRESHOLD` は値 import のため、`_data.ts`（server-only + next/headers
 * に依存）から直接取るとクライアントバンドルに next/headers が混入してしまう。
 * 純粋な定数だけを切り出した `_home-config.ts` から参照する。
 */
import { HOME_RANKING_THRESHOLD } from "@/fromhere/_home-config"
import type { AdminReviewListItem } from "@/fromhere/_admin-reviews-data"
import { MobileReviewsRotator, ReviewsCarousel } from "@/fromhere/_reviews-carousel"
import {
  type LoginStreakBadgeId,
  getNextLoginStreakBadge,
} from "@/fromhere/_login-streak"
import type { FromHereCategory } from "@/fromhere/types"
import { FROMHERE_CATEGORIES } from "@/fromhere/_product-validation"
import {
  buildHomeFiltersQueryString,
  HOME_FILTERS_DEFAULT,
  readHomeFiltersFromSearchParams,
  type HomeFilters,
} from "@/fromhere/_home-query"

const CATEGORIES: { key: FromHereCategory | "all"; i18nKey: string }[] = [
  { key: "all", i18nKey: "categoryAll" },
  ...FROMHERE_CATEGORIES.map((key) => ({
    key,
    i18nKey: `category${key.charAt(0).toUpperCase()}${key.slice(1)}`,
  })),
]

/**
 * Discord 招待 URL。
 */
const DISCORD_INVITE_URL: string | null = (() => {
  const raw = process.env.NEXT_PUBLIC_FROMHERE_DISCORD_INVITE_URL?.trim()
  if (!raw) {
    return null
  }
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:") {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
})()

/** ホーム一覧のフィルタリング（純粋関数） */
function filterProducts(
  products: HomeProduct[],
  filters: { search: string; category: FromHereCategory | "all" },
): HomeProduct[] {
  const keyword = filters.search.trim().toLowerCase()
  return products.filter((p) => {
    if (filters.category !== "all" && p.category !== filters.category) {
      return false
    }
    if (keyword) {
      const haystack = [
        p.title,
        p.tagline,
        p.description ?? "",
        p.maker.displayName,
        p.maker.handle,
        ...p.tags,
      ]
        .join(" ")
        .toLowerCase()
      if (!haystack.includes(keyword)) {
        return false
      }
    }
    return true
  })
}

/** 視覚的なフォールバック用のグラデーション（アイコン未設定時） */
const FALLBACK_GRADIENTS = [
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-sky-500",
  "from-fuchsia-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-orange-500 to-red-500",
  "from-teal-500 to-cyan-500",
  "from-yellow-400 to-orange-500",
  "from-rose-500 to-violet-500",
] as const

function pickFallbackGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  const index = Math.abs(hash) % FALLBACK_GRADIENTS.length
  return FALLBACK_GRADIENTS[index]!
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return "?"
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2 && /^[\x20-\x7e]+$/.test(trimmed)) {
    return (parts[0]![0] ?? "").concat(parts[parts.length - 1]![0] ?? "").toUpperCase()
  }
  return trimmed.slice(0, 1).toUpperCase()
}

type ProductCardProps = {
  product: HomeProduct
  /** ランクが null の場合は「ランキング表示」を行わない（順位バッジを描画しない） */
  rank: number | null
  isUpvoted: boolean
  isPending: boolean
  onToggleUpvote: () => void
}

export function ProductCard({ product, rank, isUpvoted, isPending, onToggleUpvote }: ProductCardProps) {
  const t = useTranslations("fromhere")
  const tFilters = useTranslations("fromhere.filters")
  const categoryLabel = tFilters(
    `category${product.category.charAt(0).toUpperCase()}${product.category.slice(1)}`,
  )
  const fallbackGradient = pickFallbackGradient(product.id)

  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40 hover:shadow-sm">
      {/**
       * カード全体をクリック可能にするためのオーバーレイ Link。
       * 視覚的には何も描画しないが、内側の各要素 (`relative z-10`) より下のレイヤー
       * でカード全域を覆うため、空白をクリックしても詳細ページに遷移できる。
       * 内部のタイトル / メーカー / コメント / 応援ボタンは個別のリンク / ボタンとして
       * 動作する（ネストされた a タグを避けるためにオーバーレイ方式を採用）。
       */}
      <Link
        href={`/fromhere/p/${product.slug}`}
        aria-label={product.title}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
      <div className="relative flex gap-3 p-3 sm:gap-4 sm:p-4">
        {rank !== null ? (
          <div className="pointer-events-none hidden shrink-0 flex-col items-center justify-start pt-1 sm:flex">
            <span className="text-xl font-black tabular-nums text-muted-foreground/70">
              #{rank}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg text-2xl sm:h-16 sm:w-16 sm:text-3xl",
            // 画像がある場合は背景・内側影を外してアイコンを枠ぴったりに表示する。
            // 画像が無いときだけグラデーション + shadow-inner で立体感を演出する。
            product.appIconUrl
              ? null
              : `bg-gradient-to-br ${fallbackGradient} shadow-inner`,
          )}
          aria-hidden
        >
          {product.appIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 画像をそのままプレビュー表示
            <img src={product.appIconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-bold text-white drop-shadow-sm">{getInitials(product.title)}</span>
          )}
          {rank !== null ? (
            <span className="absolute left-1 top-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[9px] font-semibold text-white sm:hidden">
              #{rank}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-bold leading-tight text-foreground sm:text-base">
              {/* オーバーレイ Link と同じ遷移先だが、見出し自体にもアンカーを残してアクセシビリティを保つ */}
              <Link
                href={`/fromhere/p/${product.slug}`}
                className="relative z-20 hover:text-primary-readable hover:underline"
              >
                {product.title}
              </Link>
            </h3>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel}
            </span>
          </div>

          <p className="mt-0.5 text-xs leading-snug text-foreground/90 sm:text-sm">
            {product.tagline}
          </p>
          {/**
           * 一覧カードでは詳細 (description) は表示しない。詳細はプロダクト詳細ページで確認する。
           * 一覧では「アイコン・タイトル・タグライン・タグ」までを見せる構成。
           */}

          {product.tags.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background/60 px-1 py-0.5 text-[9px] text-muted-foreground"
                >
                  <Hash className="h-2 w-2" aria-hidden />
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative z-20 flex shrink-0 items-stretch gap-1.5">
          {/**
           * コメント数を応援ボタンと同じサイズ・配置で表示する。
           * クリックで詳細ページへ遷移し、コメントセクションを見られるようにする。
           */}
          <Link
            href={`/fromhere/p/${product.slug}#comments`}
            aria-label={t("comments")}
            className="group/comments inline-flex h-full min-h-[64px] w-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-background px-1.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary-readable sm:w-14"
          >
            <MessageCircle
              className="h-4 w-4 transition-transform group-hover/comments:-translate-y-0.5"
              aria-hidden
            />
            <span className="tabular-nums">{product.commentCount}</span>
          </Link>
          <button
            type="button"
            onClick={onToggleUpvote}
            aria-pressed={isUpvoted}
            disabled={isPending}
            aria-label={isUpvoted ? t("upvoted") : t("upvote")}
            className={cn(
              "group/upvote inline-flex h-full min-h-[64px] w-12 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1.5 text-xs font-semibold transition-all sm:w-14",
              isUpvoted
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary-readable",
              isPending && "opacity-60",
            )}
          >
            <ArrowUp
              className={cn(
                "h-4 w-4 transition-transform",
                isUpvoted ? "" : "group-hover/upvote:-translate-y-0.5",
              )}
              aria-hidden
            />
            <span className="tabular-nums">{product.upvoteCount + (isUpvoted ? 1 : 0)}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

type FromHerePageProps = {
  initialData: HomeData
  initialReviews?: AdminReviewListItem[]
  isAdmin?: boolean
}

export function FromHerePage({
  initialData,
  initialReviews = [],
  isAdmin = false,
}: FromHerePageProps) {
  const t = useTranslations("fromhere")
  const tFilters = useTranslations("fromhere.filters")
  const tSection = useTranslations("fromhere.section")
  const tSidebar = useTranslations("fromhere.sidebar")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, profile, streak } = useFromHereAuth()

  const submitHref = user ? "/fromhere/submit" : "/fromhere/signup"

  /**
   * フィルター状態の単一情報源は URL。
   * - category と q のみ扱う（旧 range / sort は廃止）。
   * - q は入力遅延の都合で local state で持ち、debounce 後に URL に反映する。
   */
  const urlFilters = readHomeFiltersFromSearchParams(searchParams)
  const { category } = urlFilters

  const [searchInput, setSearchInput] = useState<string>(urlFilters.q)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL q の外部変化を入力欄に追従させる
    setSearchInput(urlFilters.q)
  }, [urlFilters.q])

  useEffect(() => {
    const handle = setTimeout(() => {
      const next: HomeFilters = { ...urlFilters, q: searchInput }
      const qs = buildHomeFiltersQueryString(next, searchParams)
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }, 250)
    return () => clearTimeout(handle)
    // urlFilters / searchParams / pathname / router は最新値を内部で参照しているため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const commitFilters = (changes: Partial<HomeFilters>) => {
    const next: HomeFilters = { ...urlFilters, ...changes }
    const qs = buildHomeFiltersQueryString(next, searchParams)
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(
    () => new Set(initialData.upvotedProductIds),
  )
  const [pendingUpvotes, setPendingUpvotes] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id
      if (!uid) {
        if (!cancelled) {
          setUpvotedIds(new Set())
        }
        return
      }
      const { data: rows } = await supabase
        .from("newvibes_upvotes")
        .select("product_id")
        .eq("user_id", uid)
      if (!cancelled && rows) {
        setUpvotedIds(new Set((rows as { product_id: string }[]).map((row) => row.product_id)))
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /**
   * 応援ボタンの押下処理。
   */
  const handleToggleUpvote = async (id: string) => {
    if (!user?.id) {
      router.push("/fromhere/signin")
      return
    }
    if (!profile) {
      router.push("/fromhere/onboarding")
      return
    }
    if (pendingUpvotes.has(id)) {
      return
    }
    setPendingUpvotes((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })

    const supabase = getSupabaseBrowserClient()
    const wasUpvoted = upvotedIds.has(id)

    setUpvotedIds((prev) => {
      const next = new Set(prev)
      if (wasUpvoted) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

    const result = wasUpvoted
      ? await supabase
          .from("newvibes_upvotes")
          .delete()
          .eq("product_id", id)
          .eq("user_id", user.id)
      : await supabase.from("newvibes_upvotes").insert({ product_id: id, user_id: user.id })

    if (result.error) {
      setUpvotedIds((prev) => {
        const next = new Set(prev)
        if (wasUpvoted) {
          next.add(id)
        } else {
          next.delete(id)
        }
        return next
      })
      setNotice(toErrorNotice(result.error, false))
    }
    setPendingUpvotes((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /** ----------------------------------------------------------
   *  セクション一覧と「検索/カテゴリ絞り込み中の統合表示」の分岐
   * ---------------------------------------------------------- */
  const { sections } = initialData
  const sectionConfigs: SectionConfig[] = [
    {
      key: "today",
      products: sections.today.products,
      totalCount: sections.today.totalCount,
      rankingThreshold: HOME_RANKING_THRESHOLD.today,
      viewAllHref: "/fromhere/today",
    },
    {
      key: "thisMonth",
      products: sections.thisMonth.products,
      totalCount: sections.thisMonth.totalCount,
      rankingThreshold: HOME_RANKING_THRESHOLD.thisMonth,
      viewAllHref: "/fromhere/month",
    },
    {
      key: "lastMonth",
      products: sections.lastMonth.products,
      totalCount: sections.lastMonth.totalCount,
      rankingThreshold: 0, // 取得した時点でランキング扱い（常に順位を出す）
      viewAllHref: null,
    },
    {
      key: "older",
      products: sections.older.products,
      totalCount: sections.older.totalCount,
      rankingThreshold: 0,
      viewAllHref: null,
    },
  ]

  /** 4 セクションを連結 + dedupe（同じ id が複数セクションに登場する事は無いが安全側） */
  const aggregatedProducts: HomeProduct[] = (() => {
    const seen = new Set<string>()
    const merged: HomeProduct[] = []
    for (const conf of sectionConfigs) {
      for (const p of conf.products) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        merged.push(p)
      }
    }
    return merged
  })()

  const hasAnyProducts = aggregatedProducts.length > 0
  const isFiltering = searchInput.trim().length > 0 || category !== HOME_FILTERS_DEFAULT.category
  const filteredProducts = isFiltering
    ? filterProducts(aggregatedProducts, { search: searchInput, category })
    : aggregatedProducts
  const hasFilteredResults = filteredProducts.length > 0

  const resetFilters = () => {
    setSearchInput("")
    commitFilters({ ...HOME_FILTERS_DEFAULT })
  }

  /** 共通の ProductCard レンダラ */
  const renderProductCard = (product: HomeProduct, rank: number | null) => (
    <ProductCard
      product={product}
      rank={rank}
      isUpvoted={upvotedIds.has(product.id)}
      isPending={pendingUpvotes.has(product.id)}
      onToggleUpvote={() => void handleToggleUpvote(product.id)}
    />
  )

  return (
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      {/* ----- ヘッダー下フィルタ。検索窓を大きくし、期間/並べ替えは廃止 ----- */}
      <section className="sticky top-16 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-8">
          {/**
           * スマホ (md 未満): 検索バーの右にネイティブ `<select>` を配置してカテゴリを
           * 1 タップで切り替えられるコンパクト UI に。
           * デスクトップ (md 以上): 検索バー下に従来の横スクロール ピル UI を表示する。
           */}
          <div className="flex w-full items-stretch gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={tFilters("searchPlaceholder")}
                className="h-12 w-full border-border bg-background pl-11 pr-4 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            {/* スマホ専用カテゴリピッカー (md 以上では下のピル UI を使うため非表示) */}
            <select
              value={category}
              onChange={(e) =>
                commitFilters({ category: e.target.value as FromHereCategory | "all" })
              }
              aria-label={tFilters("categoryHeading")}
              className="md:hidden h-12 shrink-0 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {tFilters(c.i18nKey)}
                </option>
              ))}
            </select>
          </div>

          {/* md 以上のみ: 横スクロールのピル形式カテゴリ一覧 */}
          <div className="mt-3 -mx-4 hidden gap-1.5 overflow-x-auto px-4 pb-1 md:-mx-8 md:flex md:px-8">
            {CATEGORIES.map((c) => {
              const active = category === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() =>
                    commitFilters({ category: c.key as FromHereCategory | "all" })
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {tFilters(c.i18nKey)}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/**
       * スマホ専用: 「編集部セレクト」を検索窓直下に配置する。
       * lg 以上ではサイドバーの SidebarCard で同じ内容を表示するため、ここでは非表示。
       * - 2 件以上のときは `MobileReviewsRotator` が 1 件ずつ横スライドで切り替える。
       * - 表示件数は最大 15 件、切替間隔はデスクトップ版と同じ 3000ms。
       * - サイドバー版と同じ「薄いオレンジ」背景でブランド統一感を出す。
       */}
      {initialReviews.length > 0 ? (
        <section className="border-b border-primary/20 bg-primary/5 lg:hidden">
          <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-8">
            <header className="mb-2">
              <h2 className="text-lg font-bold text-foreground md:text-xl">
                {tSidebar("reviewHeading")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {tSidebar("reviewSubheading")}
              </p>
            </header>
            <MobileReviewsRotator reviews={initialReviews} />
          </div>
        </section>
      ) : null}

      <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {!hasAnyProducts ? (
              <EmptyHomeState
                title={t("emptyTitle")}
                body={t("emptyBody")}
                ctaHref={submitHref}
                ctaLabel={user ? t("emptyCtaSignedIn") : t("emptyCtaGuest")}
              />
            ) : isFiltering ? (
              /* ===== 検索/カテゴリ絞り込み中: 4 セクションを統合した単一リストで表示 ===== */
              hasFilteredResults ? (
                <FilteredResultList
                  products={filteredProducts}
                  renderCard={renderProductCard}
                  showingCountLabel={tSection("filteredShowing", {
                    n: filteredProducts.length,
                  })}
                />
              ) : (
                <NoFilteredState
                  title={t("noFilteredTitle")}
                  body={t("noFilteredBody")}
                  onReset={resetFilters}
                  resetLabel={t("noFilteredAction")}
                />
              )
            ) : (
              /* ===== 通常: 4 セクション縦並び ===== */
              <div className="space-y-10">
                {sectionConfigs.map((conf) =>
                  conf.products.length === 0 ? null : (
                    <ProductSection
                      key={conf.key}
                      heading={tSection(`${conf.key}Heading`)}
                      products={conf.products}
                      totalCount={conf.totalCount}
                      rankingThreshold={conf.rankingThreshold}
                      viewAllHref={conf.viewAllHref}
                      viewAllLabel={
                        conf.key === "today"
                          ? tSection("todayViewAll")
                          : conf.key === "thisMonth"
                            ? tSection("thisMonthViewAll")
                            : null
                      }
                      renderCard={renderProductCard}
                    />
                  ),
                )}
              </div>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-[10.5rem] lg:self-start">
            {/**
             * サイドバーの「編集部セレクト」は lg 以上専用。
             * スマホでは検索窓直下の `MobileReviewsRotator` が同じ内容を横スライドで
             * 表示するため、サイドバー側は `hidden lg:block` で隠して二重表示を防ぐ。
             */}
            <div className="hidden lg:block">
              <SidebarCard
                heading={tSidebar("reviewHeading")}
                hint={tSidebar("reviewSubheading")}
                /**
                 * 「編集部セレクト」見出しは ProductSection (「今月のトッププロダクト」等) の
                 * 見出しと完全に揃える: `text-lg font-bold text-foreground md:text-xl`。
                 * フォントもサイト既定の Geist Sans。
                 * サブテキスト (`hint`) は `mt-2` で見出しとの間隔を確保。
                 *
                 * `className`: 既定の `bg-card` を上書きしてアクセントカラーに寄せた
                 *  薄い背景を当てる。色は `--primary` (= `#e64a19` 系のブランドカラー) を
                 *  そのまま使い、透明度を抑えてほんのり色付け:
                 *   - 背景: `bg-primary/5` (約 5% 透明)
                 *   - 枠線: `border-primary/20` (約 20% 透明)
                 *  CSS 変数経由でテーマ追従するため、ライト/ダーク両モードで自然に馴染む。
                 */
                headingClassName="text-lg font-bold text-foreground md:text-xl"
                hintClassName="mt-2 whitespace-normal leading-snug text-muted-foreground"
                className="bg-primary/5 border-primary/20"
              >
                <ReviewsCarousel reviews={initialReviews} isAdmin={isAdmin} />
              </SidebarCard>
            </div>

            <SidebarCard
              icon={<Lightbulb className="h-4 w-4" aria-hidden />}
              heading={tSidebar("tipsHeading")}
            >
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {tSidebar("tip1")}
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {tSidebar("tip2")}
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  {tSidebar("tip3")}
                </li>
              </ul>
            </SidebarCard>

            <SidebarCard
              icon={<Flame className="h-4 w-4" aria-hidden />}
              heading={tSidebar("streakHeading")}
            >
              {!user ? (
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {tSidebar("streakSignedOut")}
                  </p>
                  <Button asChild variant="outline" className="w-full border-border bg-background text-sm">
                    <Link href="/fromhere/signin">{tSidebar("streakSignInCta")}</Link>
                  </Button>
                </div>
              ) : streak === null ? (
                <p className="text-xs text-muted-foreground">{tSidebar("streakLoading")}</p>
              ) : (
                <LoginStreakBlock
                  streak={streak}
                  tSidebar={tSidebar}
                />
              )}
            </SidebarCard>

            <SidebarCard
              icon={<Users className="h-4 w-4" aria-hidden />}
              heading={tSidebar("communityHeading")}
              hint={tSidebar("communityHint")}
            >
              {DISCORD_INVITE_URL ? (
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-center border-border bg-background text-sm hover:border-primary/40"
                >
                  <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                    {tSidebar("communityCta")}
                  </a>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="w-full cursor-not-allowed justify-center border-border bg-background text-sm text-muted-foreground"
                >
                  {tSidebar("communityCta")}
                </Button>
              )}
            </SidebarCard>
          </aside>
        </div>
      </div>
    </main>
  )
}

/** ----------------------------------------------------------
 *  セクション 1 つ分の表示
 *  - products.length >= rankingThreshold ならランキング、未満なら一覧扱い。
 *  - viewAllHref がある場合は最下部に「すべて見る」ボタンを表示。
 * ---------------------------------------------------------- */
type SectionConfig = {
  key: "today" | "thisMonth" | "lastMonth" | "older"
  products: HomeProduct[]
  totalCount: number
  rankingThreshold: number
  viewAllHref: string | null
}

type ProductSectionProps = {
  heading: string
  hint?: string
  products: HomeProduct[]
  totalCount: number
  rankingThreshold: number
  viewAllHref: string | null
  viewAllLabel: string | null
  renderCard: (product: HomeProduct, rank: number | null) => React.ReactNode
}

function ProductSection({
  heading,
  hint,
  products,
  rankingThreshold,
  viewAllHref,
  viewAllLabel,
  renderCard,
}: ProductSectionProps) {
  const showRank = products.length >= rankingThreshold

  return (
    <section className="scroll-mt-32">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground md:text-xl">{heading}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {products.map((p, i) => (
          <li key={p.id}>{renderCard(p, showRank ? i + 1 : null)}</li>
        ))}
      </ul>
      {viewAllHref && viewAllLabel ? (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline" className="min-w-[220px]">
            <Link href={viewAllHref}>
              {viewAllLabel}
              <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/** 検索 / カテゴリ絞り込み中の統合表示 */
function FilteredResultList({
  products,
  renderCard,
  showingCountLabel,
}: {
  products: HomeProduct[]
  renderCard: (product: HomeProduct, rank: number | null) => React.ReactNode
  showingCountLabel: string
}) {
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{showingCountLabel}</p>
      <ul className="flex flex-col gap-3">
        {products.map((p) => (
          <li key={p.id}>{renderCard(p, null)}</li>
        ))}
      </ul>
    </div>
  )
}

type SidebarCardProps = {
  id?: string
  /** 見出し左に置くアイコン。省略時はアイコンタイルごと描画しない */
  icon?: React.ReactNode
  heading: string
  /** 長い見出しを一行に収めたいケース等で h2 に追加スタイルを当てるためのスロット */
  headingClassName?: string
  hint?: string
  /** hint テキストにスタイル拡張 (折り返し許可・色変更など) を当てるためのスロット */
  hintClassName?: string
  /** ルート `<section>` に追加クラスを当てる (背景色や枠の上書きなど) */
  className?: string
  children: React.ReactNode
}

function SidebarCard({
  id,
  icon,
  heading,
  headingClassName,
  hint,
  hintClassName,
  className,
  children,
}: SidebarCardProps) {
  return (
    <section
      id={id}
      className={cn("rounded-2xl border border-border bg-card p-4 scroll-mt-32", className)}
    >
      <div className="mb-3 flex items-center gap-2">
        {icon ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary-readable">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className={cn("text-sm font-bold text-foreground", headingClassName)}>{heading}</h2>
          {hint ? (
            <p className={cn("truncate text-[11px] text-muted-foreground", hintClassName)}>{hint}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

/** ----------------------------------------------------------
 *  連続ログインバッジ表示用ブロック
 * ---------------------------------------------------------- */

type LoginStreakBlockProps = {
  streak: { currentStreak: number; longestStreak: number; currentBadge: LoginStreakBadgeId | null }
  tSidebar: (key: string, params?: Record<string, string | number>) => string
}

function LoginStreakBlock({ streak, tSidebar }: LoginStreakBlockProps) {
  const next = getNextLoginStreakBadge(streak.currentStreak)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-white">
          <Flame className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black leading-none tabular-nums text-foreground">
            {streak.currentStreak}
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              {tSidebar("streakDaysUnit")}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tSidebar("streakLongest", { days: streak.longestStreak })}
          </p>
        </div>
        {streak.currentBadge ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            <Award className="h-3 w-3" aria-hidden />
            {tSidebar(`streakBadge.${streak.currentBadge}`)}
          </span>
        ) : null}
      </div>

      {next ? (
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
          {tSidebar("streakNextHint", {
            days: next.daysToGo,
            badge: tSidebar(`streakBadge.${next.id}`),
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          {tSidebar("streakAllAchieved")}
        </div>
      )}
    </div>
  )
}

type EmptyHomeStateProps = {
  title: string
  body: string
  ctaHref: string
  ctaLabel: string
}

function EmptyHomeState({ title, body, ctaHref, ctaLabel }: EmptyHomeStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary-readable">
        <Sparkles className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90">
        <Link href={ctaHref}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {ctaLabel}
        </Link>
      </Button>
    </div>
  )
}

type NoFilteredStateProps = {
  title: string
  body: string
  onReset: (() => void) | null
  resetLabel: string
}

function NoFilteredState({ title, body, onReset, resetLabel }: NoFilteredStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
      {onReset ? (
        <Button type="button" variant="outline" className="mt-4" onClick={onReset}>
          {resetLabel}
        </Button>
      ) : null}
    </div>
  )
}
