"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import type { HomeProduct } from "@/fromhere/_data"
import { ProductCard } from "@/fromhere/FromHerePage"

type Props = {
  period: "today" | "thisMonth"
  products: HomeProduct[]
  totalCount: number
  /** products.length がこの値以上なら順位を表示する */
  rankingThreshold: number
  initialUpvotedProductIds: string[]
}

/**
 * 「本日始まったプロダクトをすべて見る」「今月始まったプロダクトをすべて見る」共通 UI。
 *
 * - products は SSR で取得済み（応援数 desc）。
 * - 件数が rankingThreshold 以上ならランキング (#1, #2, ...) 表示、未満なら一覧表示。
 * - upvote 操作はホーム画面と同じ楽観的更新ロジック。
 */
export function PeriodPageClient({
  period,
  products,
  totalCount,
  rankingThreshold,
  initialUpvotedProductIds,
}: Props) {
  const t = useTranslations("fromhere")
  const tSection = useTranslations("fromhere.section")
  const router = useRouter()
  const { user, profile } = useFromHereAuth()

  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(
    () => new Set(initialUpvotedProductIds),
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
        if (!cancelled) setUpvotedIds(new Set())
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

  const showRank = products.length >= rankingThreshold
  const heading = tSection(period === "today" ? "todayHeading" : "thisMonthHeading")
  const countLabel = tSection("totalCount", { n: totalCount })

  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-5xl px-4 py-8 md:px-8">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <div className="mb-6">
        <Link
          href="/fromhere"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("backToHome")}
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{heading}</h1>
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">{countLabel}</p>
      </header>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Button asChild className="mt-5">
            <Link href="/fromhere">{t("backToHome")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((p, i) => (
            <li key={p.id}>
              <ProductCard
                product={p}
                rank={showRank ? i + 1 : null}
                isUpvoted={upvotedIds.has(p.id)}
                isPending={pendingUpvotes.has(p.id)}
                onToggleUpvote={() => void handleToggleUpvote(p.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
