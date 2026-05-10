"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Undo2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type TransactionRow = {
  id: string
  created_at: string | null
  skill_id: string | null
  buyer_id: string | null
  seller_id: string | null
  price: number | null
  status: string | null
  stripe_payment_intent_id: string | null
}

const STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  in_progress: "進行中",
  approval_pending: "完了申請中",
  awaiting_payment: "決済待ち",
  pending: "保留中",
  completed: "成功",
  disputed: "異議申し立て中",
  canceled: "キャンセル",
  refunded: "返金済み",
}

const PAGE_SIZE = 20

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatPrice(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—"
  }
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`
}

export default function AdminTransactionsPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [skillTitleMap, setSkillTitleMap] = useState<Record<string, string>>({})
  const [profileNameMap, setProfileNameMap] = useState<Record<string, string>>({})
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setCheckingAdmin(true)
      setAccessDenied(false)

      const { data, error } = await supabase.auth.getUser()
      if (cancelled) {
        return
      }
      if (error || !data.user?.id) {
        setAccessDenied(true)
        setCheckingAdmin(false)
        return
      }

      const isAdmin = await getIsAdminFromProfile(supabase, data.user.id)
      if (cancelled) {
        return
      }
      setAccessDenied(!isAdmin)
      setCheckingAdmin(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (checkingAdmin || accessDenied) {
      setLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      setErrorMessage(null)
      const q = search.trim()
      const escapedLike = q.replace(/[%_]/g, "\\$&")
      const isNumericSearch = /^\d+$/.test(q)

      let countQuery = supabase.from("transactions").select("id", { count: "exact", head: true })
      if (q.length > 0) {
        if (isNumericSearch) {
          countQuery = countQuery.or(
            `id.eq.${q},buyer_id.ilike.%${escapedLike}%,seller_id.ilike.%${escapedLike}%`,
          )
        } else {
          countQuery = countQuery.or(`buyer_id.ilike.%${escapedLike}%,seller_id.ilike.%${escapedLike}%`)
        }
      }
      const { count, error: countError } = await countQuery

      if (cancelled) {
        return
      }

      if (countError) {
        setErrorMessage("取引データの取得に失敗しました。")
        setRows([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      const total = count ?? 0
      setTotalCount(total)
      const start = (currentPage - 1) * PAGE_SIZE
      const end = start + PAGE_SIZE - 1
      if (total > 0 && start >= total) {
        const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
        setCurrentPage(lastPage)
        setLoading(false)
        return
      }

      let dataQuery = supabase
        .from("transactions")
        .select("id, created_at, skill_id, buyer_id, seller_id, price, status, stripe_payment_intent_id")
        .order("created_at", { ascending: false })
        .range(start, end)
      if (q.length > 0) {
        if (isNumericSearch) {
          dataQuery = dataQuery.or(
            `id.eq.${q},buyer_id.ilike.%${escapedLike}%,seller_id.ilike.%${escapedLike}%`,
          )
        } else {
          dataQuery = dataQuery.or(`buyer_id.ilike.%${escapedLike}%,seller_id.ilike.%${escapedLike}%`)
        }
      }
      const { data, error } = await dataQuery

      if (cancelled) {
        return
      }
      if (error) {
        setErrorMessage("取引データの取得に失敗しました。")
        setRows([])
        setLoading(false)
        return
      }

      const transactionRows = (data ?? []) as TransactionRow[]
      setRows(transactionRows)

      const skillIds = [...new Set(transactionRows.map((row) => String(row.skill_id ?? "")).filter((id) => id.length > 0))]
      const userIds = [...new Set(
        transactionRows
          .flatMap((row) => [String(row.buyer_id ?? ""), String(row.seller_id ?? "")])
          .filter((id) => id.length > 0),
      )]

      if (skillIds.length > 0) {
        const { data: skills } = await supabase.from("skills").select("id, title").in("id", skillIds)
        if (!cancelled) {
          const nextSkillMap: Record<string, string> = {}
          for (const skill of (skills ?? []) as Array<{ id: string; title: string | null }>) {
            nextSkillMap[String(skill.id)] = (skill.title ?? "").trim() || "（タイトル未設定）"
          }
          setSkillTitleMap(nextSkillMap)
        }
      } else {
        setSkillTitleMap({})
      }

      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds)
        if (!cancelled) {
          const nextProfileMap: Record<string, string> = {}
          for (const profile of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) {
            const id = String(profile.id)
            const displayName = (profile.display_name ?? "").trim()
            nextProfileMap[id] = displayName || id
          }
          setProfileNameMap(nextProfileMap)
        }
      } else {
        setProfileNameMap({})
      }

      if (!cancelled) {
        setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [accessDenied, checkingAdmin, currentPage, search, supabase])

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const handleMarkTransactionRefunded = async (transactionId: string) => {
    const ok = window.confirm(
      `取引 ${transactionId} のステータスを「返金済み」に変更しますか？\n実際の Stripe 返金はダッシュボード側の操作が必要な場合があります。`,
    )
    if (!ok) {
      return
    }
    setStatusUpdatingId(transactionId)
    setErrorMessage(null)
    const { error } = await supabase.from("transactions").update({ status: "refunded" }).eq("id", transactionId)
    setStatusUpdatingId(null)
    if (error) {
      setErrorMessage(error.message || "ステータスの更新に失敗しました。")
      return
    }
    setRows((prev) => prev.map((r) => (r.id === transactionId ? { ...r, status: "refunded" } : r)))
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-200">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-red-500" />
        管理者権限を確認中...
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-sm text-amber-300">管理者のみアクセスできます。</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">取引一覧</h1>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300" htmlFor="admin-transaction-search">
          検索（取引ID・購入者ID・出品者ID）
        </label>
        <Input
          id="admin-transaction-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="取引ID または ユーザーID（購入者/出品者）"
          className="max-w-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        {loading ? (
          <div className="flex items-center text-sm text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" />
            読み込み中...
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-red-400">{errorMessage}</p>
        ) : totalCount === 0 ? (
          <p className="text-sm text-zinc-500">条件に一致する取引はありません</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2 font-semibold text-zinc-300">取引ID</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">日時</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">スキル名</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">金額</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">購入者名</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">出品者名</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">ステータス</th>
                    <th className="px-3 py-2 font-semibold text-zinc-300">Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const skillId = String(row.skill_id ?? "")
                    const buyerId = String(row.buyer_id ?? "")
                    const sellerId = String(row.seller_id ?? "")
                    const paymentIntentId = String(row.stripe_payment_intent_id ?? "").trim()
                    const stripeUrl = paymentIntentId
                      ? `https://dashboard.stripe.com/payments/${encodeURIComponent(paymentIntentId)}`
                      : ""
                    const statusRaw = String(row.status ?? "").trim()
                    const statusLabel = statusRaw ? (STATUS_LABELS[statusRaw] ?? statusRaw) : "—"
                    const buyerName = profileNameMap[buyerId] ?? buyerId
                    const sellerName = profileNameMap[sellerId] ?? sellerId
                    const canSetRefunded = statusRaw !== "refunded"
                    const statusBusy = statusUpdatingId === row.id

                    return (
                      <tr key={row.id} className="border-b border-zinc-900/70">
                        <td className="max-w-[240px] px-3 py-2 text-zinc-200">{row.id}</td>
                        <td className="px-3 py-2 text-zinc-200">{formatDateTime(row.created_at)}</td>
                        <td className="max-w-[260px] px-3 py-2 text-zinc-200">{skillTitleMap[skillId] ?? "—"}</td>
                        <td className="px-3 py-2 text-zinc-200">{formatPrice(row.price)}</td>
                        <td className="max-w-[220px] px-3 py-2 text-zinc-200">{buyerName || "—"}</td>
                        <td className="max-w-[220px] px-3 py-2 text-zinc-200">{sellerName || "—"}</td>
                        <td className="min-w-[11rem] px-3 py-2 text-zinc-200">
                          <div className="flex flex-wrap items-center gap-2">
                            {statusRaw === "refunded" ? (
                              <span className="inline-flex items-center rounded-lg bg-[var(--accent-color)] px-2.5 py-1 text-xs font-black tracking-wide text-white shadow-[0_0_20px_color-mix(in_srgb,var(--accent-color),transparent_50%)] ring-2 ring-white/35 ring-offset-2 ring-offset-zinc-950">
                                返金済み
                              </span>
                            ) : (
                              <>
                                <span>{statusLabel}</span>
                                {canSetRefunded ? (
                                  <button
                                    type="button"
                                    title="返金済みにする"
                                    aria-label="返金済みにする"
                                    disabled={statusBusy || loading}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900 text-zinc-300 transition-colors hover:border-[var(--accent-color)] hover:bg-[color-mix(in_srgb,var(--accent-color),transparent_88%)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => {
                                      void handleMarkTransactionRefunded(row.id)
                                    }}
                                  >
                                    <Undo2 className="h-4 w-4" aria-hidden />
                                  </button>
                                ) : null}
                              </>
                            )}
                            {statusBusy ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-red-500" aria-hidden />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {stripeUrl ? (
                            <Link
                              href={stripeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 transition-colors hover:bg-zinc-800"
                            >
                              Stripe
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-zinc-400">
                {totalCount}件中 {(safeCurrentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(safeCurrentPage * PAGE_SIZE, totalCount)}件を表示
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  前へ
                </button>
                <span className="text-zinc-300">
                  {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  次へ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
