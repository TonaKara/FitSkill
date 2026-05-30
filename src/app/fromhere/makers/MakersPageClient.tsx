"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Trophy, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/useI18n"
import { cn } from "@/lib/utils"

import { MAKERS_SORTS, type MakersSort } from "@/fromhere/_makers-config"
import type { MakersData } from "@/fromhere/_makers-data"

type Props = {
  data: MakersData
}

/** ----------------------------------------------------------
 *  視覚フォールバック（avatar 未設定のときに使う）
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
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
    }
  }
  return trimmed.slice(0, 1).toUpperCase()
}

function formatDate(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return null
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * /fromhere/makers — メーカー一覧。
 *
 * - 表示自体は SSR で完結する。クライアントはソート切替とページ遷移のみ。
 * - URL クエリは `?sort=top|posts|recent&page=N` の形（`_makers-data.ts` と同期）。
 */
export function MakersPageClient({ data }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("fromhere.makers")

  const updateQuery = (next: { sort?: MakersSort; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next.sort !== undefined) {
      // ソート変更時は page をリセット
      params.set("sort", next.sort)
      params.delete("page")
    }
    if (next.page !== undefined) {
      if (next.page <= 1) {
        params.delete("page")
      } else {
        params.set("page", String(next.page))
      }
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: true })
  }

  const sortOptions: { value: MakersSort; label: string }[] = MAKERS_SORTS.map((s) => ({
    value: s,
    label: t(`sort.${s}`),
  }))

  return (
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {t("heading")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("total", { count: String(data.total) })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("sort.label")}:
              </span>
              <div className="flex flex-wrap gap-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateQuery({ sort: opt.value })}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      opt.value === data.sort
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
                    )}
                    aria-pressed={opt.value === data.sort}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8">
        {data.makers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.makers.map((maker, idx) => (
              <li key={maker.id}>
                <MakerCard
                  rank={(data.page - 1) * data.pageSize + idx + 1}
                  handle={maker.handle}
                  displayName={maker.displayName}
                  avatarUrl={maker.avatarUrl}
                  labels={{
                    viewProfile: t("card.viewProfile"),
                    posts: t("card.posts", { count: String(maker.totalPosts) }),
                    weeklyUpvotes: t("card.weeklyUpvotes", {
                      count: String(maker.weeklyUpvotes),
                    }),
                    lastPosted: maker.lastPostedAt
                      ? t("card.lastPosted", { date: formatDate(maker.lastPostedAt) ?? "" })
                      : t("card.noPosts"),
                  }}
                  showRankBadge={data.sort === "top" && data.page === 1 && idx < 3}
                />
              </li>
            ))}
          </ul>
        )}

        {data.totalPages > 1 ? (
          <nav
            aria-label="pagination"
            className="mt-8 flex items-center justify-center gap-2 text-sm"
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={data.page <= 1}
              onClick={() => updateQuery({ page: data.page - 1 })}
              className="gap-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              {t("pagination.prev")}
            </Button>
            <span className="px-3 text-sm tabular-nums text-muted-foreground">
              {t("pagination.page", {
                page: String(data.page),
                total: String(data.totalPages),
              })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={data.page >= data.totalPages}
              onClick={() => updateQuery({ page: data.page + 1 })}
              className="gap-1.5"
            >
              {t("pagination.next")}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </nav>
        ) : null}
      </section>
    </main>
  )
}

/** ----------------------------------------------------------
 *  メーカーカード
 * ---------------------------------------------------------- */
type MakerCardProps = {
  rank: number
  handle: string
  displayName: string
  avatarUrl: string | null
  labels: {
    viewProfile: string
    posts: string
    weeklyUpvotes: string
    lastPosted: string
  }
  showRankBadge: boolean
}

function MakerCard({
  rank,
  handle,
  displayName,
  avatarUrl,
  labels,
  showRankBadge,
}: MakerCardProps) {
  const gradient = pickFallbackGradient(handle || displayName || String(rank))
  const profileHref = handle ? `/fromhere/u/${encodeURIComponent(handle)}` : null
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
      {showRankBadge ? (
        <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <Trophy className="h-3 w-3" aria-hidden />#{rank}
        </div>
      ) : (
        <span className="pointer-events-none absolute right-3 top-3 text-[10px] font-semibold text-muted-foreground/70 tabular-nums">
          #{rank}
        </span>
      )}

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full",
            avatarUrl ? "bg-muted" : `bg-gradient-to-br ${gradient}`,
          )}
          aria-hidden
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開 URL
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">{getInitials(displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-foreground">{displayName || "—"}</p>
          {handle ? (
            <p className="truncate text-xs text-muted-foreground">@{handle}</p>
          ) : null}
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{labels.lastPosted}</p>
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-2 text-xs">
        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
          <dd className="text-sm font-bold tabular-nums text-foreground">{labels.posts}</dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
          <dd className="text-sm font-bold tabular-nums text-foreground">
            {labels.weeklyUpvotes}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end">
        {profileHref ? (
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href={profileHref}>{labels.viewProfile}</Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}
