"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"
import { useGritvibAdminMobileLayout } from "@/lib/talk/use-admin-mobile-layout"
import { MobileAdminSheet } from "@/talk/admin/_mobile-admin-sheet"
import {
  describeGritvibInquiryStatus,
  GRITVIB_INQUIRY_STATUSES,
  type GritvibInquiryStatus,
} from "@/lib/talk/inquiry-constants"
import {
  fetchGritvibInquiryDetailAction,
  getGritvibInquiryAttachmentUrlAction,
  listGritvibInquiriesAction,
  updateGritvibInquiryStatusAction,
  type GritvibInquiryDetail,
  type GritvibInquirySummary,
} from "@/talk/admin/_inquiry-actions"

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "未対応" },
  { value: "investigating", label: "調査中" },
  { value: "resolved", label: "対応済み" },
] as const

function formatJa(dt: string | null): string {
  if (!dt) return ""
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dt))
  } catch {
    return dt
  }
}

export function AdminInquiriesPanel({
  pendingCount: initialPendingCount,
  onPendingCountChange,
}: {
  pendingCount: number
  onPendingCountChange: (count: number) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobileLayout = useGritvibAdminMobileLayout()
  const selectedIdRaw = searchParams.get("inquiry")
  const selectedId =
    selectedIdRaw && /^\d+$/.test(selectedIdRaw) ? Number(selectedIdRaw) : null

  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTER_OPTIONS)[number]["value"]>("pending")
  const [inquiries, setInquiries] = useState<GritvibInquirySummary[]>([])
  const [detail, setDetail] = useState<GritvibInquiryDetail | null>(null)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    const result = await listGritvibInquiriesAction({
      status: statusFilter === "all" ? "all" : (statusFilter as GritvibInquiryStatus),
    })
    if (!result.ok) {
      setErrorMessage("問い合わせ一覧の取得に失敗しました。")
      return
    }
    setInquiries(result.inquiries)
    onPendingCountChange(result.pendingCount)
    setErrorMessage(null)
  }, [statusFilter, onPendingCountChange])

  useEffect(() => {
    let cancelled = false
    setLoadingList(true)
    void (async () => {
      await loadList()
      if (!cancelled) setLoadingList(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadList])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      setAttachmentUrl(null)
      return
    }

    let cancelled = false
    setLoadingDetail(true)
    void (async () => {
      const result = await fetchGritvibInquiryDetailAction(selectedId)
      if (cancelled) return
      if (!result.ok) {
        setDetail(null)
        setErrorMessage("問い合わせの取得に失敗しました。")
        setLoadingDetail(false)
        return
      }
      setDetail(result.inquiry)
      setErrorMessage(null)
      setLoadingDetail(false)

      if (result.inquiry.hasAttachment) {
        const att = await getGritvibInquiryAttachmentUrlAction(selectedId)
        if (!cancelled) {
          setAttachmentUrl(att.ok ? att.url : null)
        }
      } else {
        setAttachmentUrl(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedId])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadList()
      if (selectedId) {
        const result = await fetchGritvibInquiryDetailAction(selectedId)
        if (result.ok) setDetail(result.inquiry)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleSelectInquiry = useCallback(
    (id: number | null) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", "inquiries")
      if (id) {
        params.set("inquiry", String(id))
      } else {
        params.delete("inquiry")
      }
      const qs = params.toString()
      router.replace(qs ? `/talk/admin?${qs}` : "/talk/admin?view=inquiries")
    },
    [router, searchParams],
  )

  const handleStatusChange = async (next: GritvibInquiryStatus) => {
    if (!selectedId || !detail) return
    setStatusUpdating(true)
    try {
      const result = await updateGritvibInquiryStatusAction({
        inquiryId: selectedId,
        status: next,
      })
      if (!result.ok) {
        setErrorMessage("ステータスの更新に失敗しました。")
        return
      }
      setDetail({ ...detail, status: next })
      await loadList()
    } finally {
      setStatusUpdating(false)
    }
  }

  const listTitle = useMemo(() => {
    if (initialPendingCount > 0 && statusFilter === "pending") {
      return `問い合わせ（未対応 ${initialPendingCount}）`
    }
    return "問い合わせ"
  }, [initialPendingCount, statusFilter])

  const detailBody =
    detail && !loadingDetail ? (
      <InquiryDetailBody
        detail={detail}
        attachmentUrl={attachmentUrl}
        errorMessage={errorMessage}
        statusUpdating={statusUpdating}
        onStatusChange={handleStatusChange}
      />
    ) : loadingDetail && selectedId ? (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        読み込み中…
      </div>
    ) : null

  return (
    <div className="relative flex min-h-0 flex-1">
      <aside className="flex min-h-0 w-full flex-col border-r border-zinc-200 md:w-96 md:flex-none">
        <div className="border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-black">{listTitle}</h2>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing || loadingList}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-zinc-300 px-2 text-[11px] text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3 w-3" aria-hidden />
              )}
              更新
            </button>
          </div>
          <label className="mt-3 block text-[11px] text-zinc-500" htmlFor="inquiry-status-filter">
            ステータス
          </label>
          <select
            id="inquiry-status-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as (typeof STATUS_FILTER_OPTIONS)[number]["value"])
            }
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </div>
          ) : inquiries.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-zinc-500">問い合わせはありません。</p>
          ) : (
            <ul className="space-y-2 p-3">
              {inquiries.map((item) => {
                const active = item.id === selectedId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectInquiry(item.id)}
                      className={[
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        active
                          ? "border-zinc-400 bg-zinc-50"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-black">
                          {item.subject || item.name}
                        </span>
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            item.status === "pending"
                              ? "bg-amber-100 text-amber-900"
                              : item.status === "resolved"
                                ? "bg-zinc-200 text-zinc-700"
                                : "bg-blue-100 text-blue-900",
                          ].join(" ")}
                        >
                          {describeGritvibInquiryStatus(item.status)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-600">{item.name}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{formatJa(item.createdAt)}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="hidden min-h-0 flex-1 flex-col md:flex">
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            左の一覧から問い合わせを選択してください。
          </div>
        ) : (
          detailBody
        )}
      </section>

      {isMobileLayout && selectedId ? (
        <MobileAdminSheet
          title={detail?.subject || detail?.name || "問い合わせ"}
          subtitle={
            detail ? describeGritvibInquiryStatus(detail.status) : undefined
          }
          onClose={() => handleSelectInquiry(null)}
        >
          {detailBody ?? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </div>
          )}
        </MobileAdminSheet>
      ) : null}
    </div>
  )
}

function InquiryDetailBody({
  detail,
  attachmentUrl,
  errorMessage,
  statusUpdating,
  onStatusChange,
}: {
  detail: GritvibInquiryDetail
  attachmentUrl: string | null
  errorMessage: string | null
  statusUpdating: boolean
  onStatusChange: (next: GritvibInquiryStatus) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {errorMessage ? (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[11px] text-zinc-500">ID</dt>
            <dd className="font-mono text-black">{detail.id}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">受付日時</dt>
            <dd className="text-black">{formatJa(detail.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">件名</dt>
            <dd className="text-black">{detail.subject}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">名前</dt>
            <dd className="text-black">{detail.name}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-zinc-500">メール</dt>
            <dd>
              <a href={`mailto:${detail.email}`} className="text-black underline">
                {detail.email}
              </a>
            </dd>
          </div>
          {detail.submitterProfileId ? (
            <div>
              <dt className="text-[11px] text-zinc-500">会員 ID</dt>
              <dd className="break-all font-mono text-xs text-black">
                {detail.submitterProfileId}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-[11px] text-zinc-500">本文</dt>
            <dd className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-black">
              {detail.content}
            </dd>
          </div>
        </dl>

        {attachmentUrl ? (
          <div className="mt-4">
            <p className="mb-2 text-[11px] text-zinc-500">添付画像</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachmentUrl}
              alt="添付画像"
              className="max-h-64 max-w-full rounded-lg border border-zinc-200 object-contain"
            />
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 px-4 py-3">
        <label
          className="hidden text-[11px] text-zinc-500 md:block"
          htmlFor="inquiry-detail-status"
        >
          ステータス
        </label>
        <div className="flex items-center gap-2 md:mt-1">
          <select
            id="inquiry-detail-status"
            aria-label="ステータス"
            value={detail.status}
            disabled={statusUpdating}
            onChange={(e) => void onStatusChange(e.target.value as GritvibInquiryStatus)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-black disabled:opacity-50 md:w-auto"
          >
            {GRITVIB_INQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {describeGritvibInquiryStatus(s)}
              </option>
            ))}
          </select>
          {statusUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" aria-hidden />
          ) : null}
        </div>
      </div>
    </div>
  )
}
