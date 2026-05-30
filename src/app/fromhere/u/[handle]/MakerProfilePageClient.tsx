"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowUp, Award, ExternalLink, Hash, MessageCircle, Plus, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import type { MakerProduct, MakerProfileData } from "@/fromhere/_maker-data"

/** ----------------------------------------------------------
 *  視覚フォールバック用のグラデーション（画像未設定時）
 * ---------------------------------------------------------- */
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
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]!
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

type MakerProfilePageClientProps = {
  data: MakerProfileData
}

/**
 * メーカープロフィールページ。
 *
 * - 構成は X / Product Hunt のメーカーページに着想を得たヒーロー + プロダクト一覧。
 * - 編集ボタン・コメント等は他フェーズで段階的に有効化する。
 * - 公開 URL は `/fromhere/u/[handle]` で固定。シェアボタンは clipboard API を利用。
 */
export function MakerProfilePageClient({ data }: MakerProfilePageClientProps) {
  const t = useTranslations("fromhere.profile")
  const tFilters = useTranslations("fromhere.filters")
  const tSidebar = useTranslations("fromhere.sidebar")
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const initials = getInitials(data.displayName || data.handle || "?")
  const gradient = pickFallbackGradient(data.id)

  const joinedLabel = t("joined", { date: formatJoinedDate(data.createdAt) })

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/fromhere/u/${data.handle}`
      await navigator.clipboard.writeText(url)
      setNotice(toSuccessNotice(t("shareCopied")))
    } catch (error) {
      setNotice(toErrorNotice(error ?? new Error(t("shareFailed")), false, { unknownErrorMessage: t("shareFailed") }))
    }
  }

  return (
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex flex-col items-center sm:items-start">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
                <img
                  src={data.avatarUrl}
                  alt={data.displayName}
                  className="h-24 w-24 rounded-full object-cover ring-2 ring-background sm:h-28 sm:w-28"
                />
              ) : (
                <div
                  className={cn(
                    "flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-3xl font-bold text-white ring-2 ring-background sm:h-28 sm:w-28 sm:text-4xl",
                    gradient,
                  )}
                  aria-hidden
                >
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {data.displayName}
                </h1>
                {data.loginStreak && data.loginStreak.currentBadge ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                    title={tSidebar("streakLongest", {
                      days: data.loginStreak.longestStreak,
                    })}
                  >
                    <Award className="h-3 w-3" aria-hidden />
                    {tSidebar(`streakBadge.${data.loginStreak.currentBadge}`)}
                  </span>
                ) : null}
                {data.viewer.isSelf ? (
                  <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-readable">
                    {t("selfBadge")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">@{data.handle}</p>
              {data.bio ? (
                <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
                  {data.bio}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">{joinedLabel}</p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => void handleShare()}>
                  <Share2 className="h-4 w-4" aria-hidden />
                  {t("share")}
                </Button>
                {data.viewer.isSelf ? (
                  <Button asChild type="button" variant="outline" className="gap-2">
                    <Link href="/fromhere/profile/edit">{t("edit")}</Link>
                  </Button>
                ) : null}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-md">
                <StatChip label={t("statsProducts")} value={data.stats.totalProducts} />
                <StatChip label={t("statsUpvotes")} value={data.stats.totalUpvotes} />
                <StatChip label={t("statsComments")} value={data.stats.totalComments} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8">
        <h2 className="text-lg font-bold text-foreground">{t("productsHeading")}</h2>
        <div className="mt-4">
          {data.products.length === 0 ? (
            <EmptyState
              showCta={data.viewer.isSelf}
              emptyLabel={t("productsEmpty")}
              ctaLabel={t("productsEmptyCtaSelf")}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.products.map((product) => (
                <li key={product.id}>
                  <ProductCard
                    product={product}
                    categoryLabel={tFilters(
                      `category${product.category.charAt(0).toUpperCase()}${product.category.slice(1)}`,
                    )}
                    draftBadge={t("draftBadge")}
                    externalLabel={t("openProductExternal")}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

/** ----------------------------------------------------------
 *  パーツ群
 * ---------------------------------------------------------- */

type StatChipProps = { label: string; value: number }

function StatChip({ label, value }: StatChipProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-black tabular-nums leading-none text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  )
}

type ProductCardProps = {
  product: MakerProduct
  categoryLabel: string
  draftBadge: string
  externalLabel: string
}

function ProductCard({ product, categoryLabel, draftBadge, externalLabel }: ProductCardProps) {
  const fallback = pickFallbackGradient(product.id)
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="flex gap-4 p-4">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl",
            // 画像があるときは内側シャドウ・背景を外して枠ぴったりに見せる。
            product.appIconUrl
              ? null
              : `bg-gradient-to-br ${fallback} shadow-inner`,
          )}
          aria-hidden
        >
          {product.appIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
            <img src={product.appIconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-bold text-white">{getInitials(product.title)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <h3 className="text-sm font-bold leading-tight text-foreground sm:text-base">
              <Link
                href={`/fromhere/p/${product.slug}`}
                className="hover:text-primary-readable hover:underline"
              >
                {product.title}
              </Link>
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel}
            </span>
            {product.status === "draft" ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                {draftBadge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {product.tagline}
          </p>
          {product.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {product.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Hash className="h-2.5 w-2.5" aria-hidden />
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                {product.upvoteCount}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                {product.commentCount}
              </span>
            </span>
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary-readable"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{externalLabel}</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

type EmptyStateProps = {
  showCta: boolean
  emptyLabel: string
  ctaLabel: string
}

function EmptyState({ showCta, emptyLabel, ctaLabel }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      {showCta ? (
        <Button asChild className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
          <Link href="/fromhere/submit">
            <Plus className="mr-1 h-4 w-4" aria-hidden />
            {ctaLabel}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

/** ----------------------------------------------------------
 *  日付フォーマット（YYYY-MM-DD まで簡潔に）
 * ---------------------------------------------------------- */
function formatJoinedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}
