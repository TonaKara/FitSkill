"use client"

import Link from "next/link"
import {
  ArrowRight,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  TrendingUp,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MyStoreListingsPanel } from "@/components/my-store-listings-panel"
import { StripeInstructorOnboardingCta } from "@/components/stripe-instructor-onboarding-cta"
import type { MyStoreDashboardStats } from "@/lib/my-store-dashboard-stats"
import type { AppNotice } from "@/lib/notifications"
import { STORE_MENU_ITEMS, storeMenuItemHref } from "@/lib/store-menu"

type MenuCard = {
  title: string
  description: string
  href: string
  icon: typeof User
}

function buildMenuCards(tradesHref: string): MenuCard[] {
  return STORE_MENU_ITEMS.filter((item) => item.slug !== "listings").map((item) => ({
    title: item.label,
    description: item.description,
    href: storeMenuItemHref(item, tradesHref),
    icon: item.icon,
  }))
}

type MyStoreDashboardProps = {
  userId: string
  stats: MyStoreDashboardStats | null
  statsLoading: boolean
  isStripeSetupComplete: boolean
  storeUrlDisplay: string
  storePath: string | null
  storeLoading: boolean
  hasCustomId: boolean
  tradesHref: string
  onCopyStoreUrl: () => void
  onNotice: (notice: AppNotice) => void
  onListingsChanged: () => void
}

const MUTED_BODY = "text-xs font-normal leading-relaxed text-neutral-400 dark:text-muted-foreground"
const MUTED_BODY_SM = "text-sm font-normal leading-relaxed text-neutral-400 dark:text-muted-foreground"

function formatYen(value: number): string {
  return `\u00a5${value.toLocaleString("ja-JP")}`
}

function SalesTrendBars({ monthlySales }: { monthlySales: MyStoreDashboardStats["monthlySales"] }) {
  const maxAmount = Math.max(1, ...monthlySales.map((point) => point.amount))

  return (
    <div className="mt-6 min-w-0">
      <p className={`mb-2 ${MUTED_BODY}`}>直近6ヶ月の受取推移</p>
      <div className="flex h-24 min-w-0 items-end gap-1 sm:gap-1.5 md:gap-2">
        {monthlySales.map((point) => {
          const heightPercent = point.amount / maxAmount
          const barHeightPx = Math.max(point.amount > 0 ? 10 : 4, Math.round(heightPercent * 64))
          return (
            <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-16 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary/90 to-primary/50"
                  style={{ height: `${barHeightPx}px` }}
                  title={formatYen(point.amount)}
                />
              </div>
              <span className="max-w-full truncate text-[10px] font-normal text-neutral-400 dark:text-muted-foreground sm:text-xs">
                {point.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StoreUrlCompactPanel({
  storeUrlDisplay,
  storePath,
  storeLoading,
  hasCustomId,
  onCopyStoreUrl,
}: Pick<
  MyStoreDashboardProps,
  "storeUrlDisplay" | "storePath" | "storeLoading" | "hasCustomId" | "onCopyStoreUrl"
>) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-foreground">
        <Link2 className="h-4 w-4 shrink-0 text-primary-readable" aria-hidden />
        ストアURL
      </div>
      <p className={`mt-1 ${MUTED_BODY}`}>ストアへの導線をワンタップで共有</p>

      {storeLoading ? (
        <p className={`mt-4 flex items-center gap-2 ${MUTED_BODY_SM}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          読み込み中...
        </p>
      ) : (
        <p className="mt-4 break-all rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
          {storeUrlDisplay || storePath || "—"}
        </p>
      )}

      {!storeLoading && !hasCustomId ? (
        <p className={`mt-3 ${MUTED_BODY}`}>
          カスタムIDは
          <Link href="/account/profile" className="font-medium text-primary-readable underline-offset-2 hover:underline">
            プロフィール設定
          </Link>
          から設定できます。
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:mt-auto lg:flex-col">
        <Button
          type="button"
          size="sm"
          className="h-auto min-h-9 w-full whitespace-normal bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          disabled={storeLoading || !storePath}
          onClick={onCopyStoreUrl}
        >
          <Copy className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          URLをコピー
        </Button>
        {storePath ? (
          <Button asChild type="button" size="sm" variant="outline" className="w-full border-border font-medium">
            <Link href={storePath} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              プレビュー
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function MyStoreDashboard({
  userId,
  stats,
  statsLoading,
  isStripeSetupComplete,
  storeUrlDisplay,
  storePath,
  storeLoading,
  hasCustomId,
  tradesHref,
  onCopyStoreUrl,
  onNotice,
  onListingsChanged,
}: MyStoreDashboardProps) {
  const menuCards = buildMenuCards(tradesHref)
  const lifetimeSales = stats?.lifetimeSalesYen ?? 0
  const stripeAvailable = stats?.stripe?.available ?? null
  const stripePending = stats?.stripe?.pending ?? null

  return (
    <section className="min-w-0 w-full max-w-full space-y-8">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-primary-readable">
          マイストア
        </p>
        <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-foreground">
          ダッシュボード
        </h2>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-primary/25 bg-accent p-4 sm:p-5 md:p-7 lg:col-span-2">
          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-foreground">
                  <TrendingUp className="h-4 w-4 shrink-0 text-primary-readable" aria-hidden />
                  {isStripeSetupComplete ? "総売上（累計）" : "売上の確認"}
                </p>
                {isStripeSetupComplete && !statsLoading ? (
                  <p className={`mt-0.5 ${MUTED_BODY}`}>
                    手数料（15%）差引後の受取額
                  </p>
                ) : null}
                {statsLoading ? (
                  <div className="mt-3 flex items-center gap-2">
                    <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
                    <span className={MUTED_BODY_SM}>売上を読み込み中...</span>
                  </div>
                ) : !isStripeSetupComplete ? (
                  <div className="mt-4 rounded-xl border border-border/80 bg-background/60 p-4 sm:p-5 md:px-6 md:text-center">
                    <p className={`${MUTED_BODY} md:text-sm`}>
                      売上は、Stripeで口座登録や本人確認を済ませるとご確認いただけます。
                    </p>
                    <StripeInstructorOnboardingCta
                      className="mt-4 md:mt-5 md:flex md:justify-center"
                      disabled={storeLoading}
                      onNotice={onNotice}
                    />
                  </div>
                ) : (
                  <p className="mt-2 break-all text-[clamp(1.75rem,7vw,3.25rem)] font-black leading-tight tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
                    {formatYen(lifetimeSales)}
                  </p>
                )}
              </div>
              {isStripeSetupComplete ? (
                <Button asChild variant="outline" size="sm" className="w-full shrink-0 border-border bg-background/80 font-medium sm:w-auto">
                  <Link href="/account/sales">詳細</Link>
                </Button>
              ) : null}
            </div>

            {isStripeSetupComplete && !statsLoading && stats ? (
              <>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                  <div className="min-w-0 rounded-xl border border-border/80 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <p className={MUTED_BODY}>完了取引</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-neutral-900 dark:text-foreground sm:text-lg">
                      {stats.completedTransactionCount.toLocaleString("ja-JP")}
                      <span className={`ml-0.5 ${MUTED_BODY}`}>件</span>
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-border/80 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <p className={MUTED_BODY}>出品中</p>
                    <p className="mt-0.5 text-base font-bold tabular-nums text-neutral-900 dark:text-foreground sm:text-lg">
                      {stats.publishedListingCount.toLocaleString("ja-JP")}
                      <span className={`ml-0.5 ${MUTED_BODY}`}>件</span>
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-border/80 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <p className={MUTED_BODY}>振込可能</p>
                    <p className="mt-0.5 break-all text-base font-bold tabular-nums leading-snug text-neutral-900 dark:text-foreground sm:text-lg">
                      {stripeAvailable != null ? formatYen(stripeAvailable) : "—"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-border/80 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <p className={MUTED_BODY}>入金予定</p>
                    <p className="mt-0.5 break-all text-base font-bold tabular-nums leading-snug text-neutral-900 dark:text-foreground sm:text-lg">
                      {stripePending != null ? formatYen(stripePending) : "—"}
                    </p>
                  </div>
                </div>

                {stats.stripeError ? (
                  <p className="mt-3 break-words text-xs font-normal text-amber-600 dark:text-amber-400">{stats.stripeError}</p>
                ) : null}

                <SalesTrendBars monthlySales={stats.monthlySales} />
              </>
            ) : null}
          </div>
        </div>

        <StoreUrlCompactPanel
          storeUrlDisplay={storeUrlDisplay}
          storePath={storePath}
          storeLoading={storeLoading}
          hasCustomId={hasCustomId}
          onCopyStoreUrl={onCopyStoreUrl}
        />
      </div>

      <MyStoreListingsPanel userId={userId} onNotice={onNotice} onListingsChanged={onListingsChanged} />

      <div className="min-w-0">
        <h3 className="mb-4 text-base font-bold text-neutral-900 dark:text-foreground">ショートカット</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {menuCards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition-transform group-hover:scale-110" />
                <div className="relative min-w-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary-readable">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <p className="mt-4 break-words text-lg font-bold text-neutral-900 group-hover:text-primary-readable dark:text-foreground">
                    {card.title}
                  </p>
                  <p className={`mt-1 break-words ${MUTED_BODY}`}>{card.description}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary-readable">
                    開く
                    <ArrowRight className="ml-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
