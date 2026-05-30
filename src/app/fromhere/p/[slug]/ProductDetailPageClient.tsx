"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  ArrowUp,
  ExternalLink,
  Hash,
  Share2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import type { ProductDetailData, ProductDetailRelated } from "@/fromhere/_product-detail-data"
import { useLocale } from "@/lib/i18n/useI18n"

import { CommentsSection } from "./_CommentsSection"

/** ----------------------------------------------------------
 *  視覚フォールバック
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

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

type Props = {
  data: ProductDetailData
}

/**
 * プロダクト詳細ページ。
 *
 * - ヒーロー + 説明 + スクリーンショット + サイドバー（メーカー情報 + 他のプロダクト）構成
 * - 応援ボタンは Supabase Storage 直叩き（RLS で保護）
 * - コメント機能は別フェーズで実装するため、プレースホルダのみ表示
 */
export function ProductDetailPageClient({ data }: Props) {
  const t = useTranslations("fromhere.detail")
  const tFilters = useTranslations("fromhere.filters")

  const router = useRouter()
  const { user, profile } = useFromHereAuth()
  const locale = useLocale()

  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [hasUpvoted, setHasUpvoted] = useState<boolean>(data.viewer.hasUpvoted)
  const [upvoteCount, setUpvoteCount] = useState<number>(data.product.upvoteCount)
  const [pending, setPending] = useState<boolean>(false)

  const categoryLabel = tFilters(
    `category${data.product.category.charAt(0).toUpperCase()}${data.product.category.slice(1)}`,
  )
  const fallback = pickFallbackGradient(data.product.id)

  const onToggleUpvote = async () => {
    if (!user?.id) {
      router.push("/fromhere/signin")
      return
    }
    if (!profile) {
      router.push("/fromhere/onboarding")
      return
    }
    if (pending) {
      return
    }
    setPending(true)
    const supabase = getSupabaseBrowserClient()
    const next = !hasUpvoted

    setHasUpvoted(next)
    setUpvoteCount((prev) => prev + (next ? 1 : -1))

    const result = next
      ? await supabase
          .from("newvibes_upvotes")
          .insert({ product_id: data.product.id, user_id: user.id })
      : await supabase
          .from("newvibes_upvotes")
          .delete()
          .eq("product_id", data.product.id)
          .eq("user_id", user.id)

    if (result.error) {
      setHasUpvoted(!next)
      setUpvoteCount((prev) => prev - (next ? 1 : -1))
      setNotice(toErrorNotice(result.error, false))
    }
    setPending(false)
  }

  const onShare = async () => {
    try {
      const url = `${window.location.origin}/fromhere/p/${data.product.slug}`
      await navigator.clipboard.writeText(url)
      setNotice(toSuccessNotice(t("shareCopied")))
    } catch (error) {
      setNotice(toErrorNotice(error ?? new Error(t("shareFailed")), false, { unknownErrorMessage: t("shareFailed") }))
    }
  }

  return (
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      {data.product.status === "draft" ? (
        <div className="border-b border-amber-500/40 bg-amber-50/80 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          {t("draftNotice")}
        </div>
      ) : null}

      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <div
              className={cn(
                "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-24 sm:w-24",
                // 画像があるときは内側シャドウ・背景を消してアイコンを枠ぴったりに表示する。
                data.product.appIconUrl
                  ? null
                  : `bg-gradient-to-br ${fallback} shadow-inner`,
              )}
              aria-hidden
            >
              {data.product.appIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
                <img src={data.product.appIconUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white sm:text-4xl">{getInitials(data.product.title)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {data.product.title}
                </h1>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {categoryLabel}
                </span>
                {data.product.status === "draft" ? (
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    {t("draftBadge")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-base text-foreground/90 sm:text-lg">{data.product.tagline}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Link
                  href={`/fromhere/u/${data.maker.handle}`}
                  className="font-medium text-foreground hover:text-primary-readable hover:underline"
                >
                  {data.maker.displayName} <span className="text-muted-foreground">@{data.maker.handle}</span>
                </Link>
                <span>·</span>
                <span>{t("postedAt", { date: formatDate(data.product.postedAt) })}</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void onToggleUpvote()}
                  aria-pressed={hasUpvoted}
                  disabled={pending}
                  className={cn(
                    "gap-2",
                    hasUpvoted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                    pending && "opacity-60",
                  )}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                  <span>{hasUpvoted ? t("upvoted") : t("upvote")}</span>
                  <span className="ml-1 tabular-nums">{upvoteCount}</span>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a
                    href={data.product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    {t("visitSite")}
                  </a>
                </Button>
                <Button type="button" variant="outline" className="gap-2" onClick={() => void onShare()}>
                  <Share2 className="h-4 w-4" aria-hidden />
                  {t("shareAction")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            {data.product.screenshotUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage スクリーンショットを直接表示 */}
                <img
                  src={data.product.screenshotUrl}
                  alt={t("screenshotAlt", { title: data.product.title })}
                  className="h-auto w-full object-cover"
                />
              </div>
            ) : null}

            {data.product.description ? (
              <section>
                <h2 className="text-lg font-bold text-foreground">{t("descriptionHeading")}</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
                  {data.product.description}
                </p>
              </section>
            ) : null}

            {data.product.tags.length > 0 ? (
              <section>
                <h2 className="text-lg font-bold text-foreground">{t("tagsHeading")}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {data.product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      <Hash className="h-3 w-3" aria-hidden />
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <CommentsSection
              productId={data.product.id}
              productSlug={data.product.slug}
              initialComments={data.comments}
              initialCount={data.product.commentCount}
              viewerIsAuthenticated={data.viewer.isAuthenticated}
              viewerHasProfile={data.viewer.hasProfile}
              locale={locale}
            />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <MakerCard ctaLabel={t("makerVisitProfile")} maker={data.maker} />

            <MoreFromMakerCard
              heading={t("moreFromMakerHeading")}
              emptyLabel={t("moreFromMakerEmpty")}
              externalLabel={t("openExternal")}
              items={data.moreFromMaker}
              categoryLabel={(c) => tFilters(`category${c.charAt(0).toUpperCase()}${c.slice(1)}`)}
            />
          </aside>
        </div>
      </div>
    </main>
  )
}

/** ----------------------------------------------------------
 *  メーカー紹介カード（見出し文言は持たない）
 * ---------------------------------------------------------- */
type MakerCardProps = {
  ctaLabel: string
  maker: ProductDetailData["maker"]
}

function MakerCard({ ctaLabel, maker }: MakerCardProps) {
  const gradient = pickFallbackGradient(maker.id)
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        {maker.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
          <img
            src={maker.avatarUrl}
            alt={maker.displayName}
            className="h-12 w-12 rounded-full object-cover ring-2 ring-background"
          />
        ) : (
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-base font-bold text-white ring-2 ring-background",
              gradient,
            )}
            aria-hidden
          >
            {getInitials(maker.displayName || maker.handle || "?")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{maker.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">@{maker.handle}</p>
          {maker.bio ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {maker.bio}
            </p>
          ) : null}
        </div>
      </div>
      <Button asChild variant="outline" className="mt-4 w-full justify-center text-sm">
        <Link href={`/fromhere/u/${maker.handle}`}>{ctaLabel}</Link>
      </Button>
    </section>
  )
}

/** ----------------------------------------------------------
 *  同じメーカーの他のプロダクト
 * ---------------------------------------------------------- */
type MoreFromMakerCardProps = {
  heading: string
  emptyLabel: string
  externalLabel: string
  items: ProductDetailRelated[]
  categoryLabel: (category: string) => string
}

function MoreFromMakerCard({ heading, emptyLabel, externalLabel, items, categoryLabel }: MoreFromMakerCardProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-bold text-foreground">{heading}</h2>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/fromhere/p/${p.slug}`}
                className="-mx-1 flex items-start gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted/60"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg",
                    p.appIconUrl ? "bg-muted" : `bg-gradient-to-br ${pickFallbackGradient(p.id)}`,
                  )}
                  aria-hidden
                >
                  {p.appIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
                    <img src={p.appIconUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-white">{getInitials(p.title)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.tagline}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <ArrowUp className="h-3 w-3" aria-hidden />
                      {p.upvoteCount}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {categoryLabel(p.category)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">{externalLabel}</span>
    </section>
  )
}
