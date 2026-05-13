"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { DetailModal } from "@/components/admin/DetailModal"
import { DisputeAdminDetailModal } from "@/components/admin/DisputeAdminDetailModal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import type { AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createAdminOriginNotification } from "@/lib/transaction-notifications"

type Filter =
  | { column: string; value: string | number | boolean }
  | { column: string; operator: "notNull" }

type AdminTableCardProps = {
  title: string
  tableName:
    | "profiles"
    | "skills"
    | "user_reports"
    | "product_reports"
    | "admin_reported_users_summary"
    | "contact_submissions"
    | "transactions"
    | "cms_pages"
    | "settings"
  columns: string[]
  orderBy?: string
  limit?: number
  filters?: Filter[]
  /** 指定時は created_at 自動ソートより優先（既定は降順） */
  sortBy?: string
  /** sortBy 指定時の昇順ソート（例: 異議一覧で申立て日時が古い順） */
  sortAscending?: boolean
  headerLabels?: Partial<Record<string, string>>
  /** profiles のみ: 取得済み行に対する id / display_name の部分一致（即時絞り込み） */
  profileSearch?: string
  /** skills のみ: 取得済み行に対する id / title の部分一致（即時絞り込み） */
  skillSearch?: string
  /** transactions の異議一覧: 行クリック時に管理用の詳細モーダルを開く */
  disputeAdminDetail?: boolean
}

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: "未対応",
  investigating: "調査中",
  resolved: "対応済み",
  ignored: "不要/スパム",
  banned: "BAN済み",
}

const TRANSACTION_STATUS_LABEL_MAP: Record<string, string> = {
  active: "進行中",
  completed: "完了",
  approval_pending: "完了申請中",
  disputed: "異議申し立て中",
  refunded: "返金済み",
  canceled: "キャンセル/返金",
}

const DISPUTE_STATUS_LABEL_MAP: Record<string, string> = {
  open: "対応待ち",
  resolved: "承認（返金済）",
  rejected: "棄却（完了）",
}

const ADMIN_REASON_OPTIONS = [
  "利用規約違反",
  "不適切な画像",
  "スパム行為",
  "虚偽または誤解を招く内容",
  "権利侵害の可能性",
  "運営判断",
] as const

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
}

function formatDateTimeCell(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusBadgeClass(status: string): string {
  if (status === "pending") {
    return "bg-red-950/60 text-red-300 ring-1 ring-red-500/40"
  }
  if (status === "investigating") {
    return "bg-blue-950/60 text-blue-300 ring-1 ring-blue-500/40"
  }
  if (status === "resolved") {
    return "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/40"
  }
  if (status === "ignored") {
    return "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600"
  }
  if (status === "banned") {
    return "bg-red-950/60 text-red-300 ring-1 ring-red-500/40"
  }
  if (status === "active") {
    return "bg-emerald-950/60 text-emerald-300 ring-1 ring-emerald-500/40"
  }
  if (status === "completed") {
    return "bg-emerald-950/60 text-emerald-200 ring-1 ring-emerald-500/35"
  }
  if (status === "disputed") {
    return "bg-amber-950/60 text-amber-200 ring-1 ring-amber-500/40"
  }
  if (status === "refunded" || status === "canceled") {
    return "bg-violet-950/60 text-violet-200 ring-1 ring-violet-500/40"
  }
  if (status === "approval_pending") {
    return "bg-sky-950/60 text-sky-200 ring-1 ring-sky-500/35"
  }
  if (status === "open") {
    return "bg-amber-950/50 text-amber-100 ring-1 ring-amber-500/35"
  }
  if (status === "rejected") {
    return "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600"
  }
  return "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-700"
}

export function AdminTableCard({
  title,
  tableName,
  columns,
  orderBy = "created_at",
  limit = 100,
  filters = [],
  sortBy,
  sortAscending = false,
  headerLabels,
  profileSearch = "",
  skillSearch = "",
  disputeAdminDetail = false,
}: AdminTableCardProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const columnsKey = columns.join("|")
  const filtersKey = JSON.stringify(filters)
  const stableFilters = useMemo(() => JSON.parse(filtersKey) as Filter[], [filtersKey])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [actionPendingKey, setActionPendingKey] = useState<string | null>(null)
  const [actionReasonMap, setActionReasonMap] = useState<Record<string, string>>({})
  const [reportedUserStatusMap, setReportedUserStatusMap] = useState<Record<string, string>>({})
  const [productPublishedMap, setProductPublishedMap] = useState<Record<string, boolean>>({})

  const updateReason = (rowKey: string, reason: string) => {
    setActionReasonMap((prev) => ({ ...prev, [rowKey]: reason }))
  }

  const notifyAdminAction = async (params: {
    recipientId: string
    type: string
    content: string
  }) => {
    const { error } = await createAdminOriginNotification(supabase, {
      recipient_id: params.recipientId,
      type: params.type,
      content: params.content,
    })
    if (error) {
      console.error("[AdminTableCard] admin notification failed", {
        message: error.message,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
        recipientId: params.recipientId,
        type: params.type,
      })
    }
  }

  const callAdminSkillModeration = async (params: {
    skillId: string | number
    action: "set_published" | "delete"
    isPublished?: boolean
    reason: string
  }): Promise<{ ok: true; archived?: boolean } | { ok: false; message: string }> => {
    const response = await fetch("/api/admin/skills/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skillId: params.skillId,
        action: params.action,
        isPublished: params.isPublished,
        reason: params.reason,
      }),
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean
      error?: string
      archived?: boolean
    } | null
    if (!response.ok || body?.ok !== true) {
      return {
        ok: false,
        message: body?.error ?? `管理者操作に失敗しました (${response.status})`,
      }
    }
    return { ok: true, archived: body?.archived === true }
  }

  const visibleRows = useMemo(() => {
    if (tableName === "profiles") {
      const q = normalizeSearchText(profileSearch)
      if (!q) {
        return rows
      }
      return rows.filter((row) => {
        const id = normalizeSearchText(row.id)
        const name = normalizeSearchText(row.display_name)
        return id.includes(q) || name.includes(q)
      })
    }
    if (tableName === "admin_reported_users_summary") {
      const q = normalizeSearchText(profileSearch)
      if (!q) {
        return rows
      }
      return rows.filter((row) => {
        const reportedUserId = normalizeSearchText(row.reported_user_id)
        const name = normalizeSearchText(row.display_name)
        return reportedUserId.includes(q) || name.includes(q)
      })
    }
    if (tableName === "skills") {
      const q = normalizeSearchText(skillSearch)
      if (!q) {
        return rows
      }
      return rows.filter((row) => {
        const id = normalizeSearchText(row.id)
        const title = normalizeSearchText(row.title)
        return id.includes(q) || title.includes(q)
      })
    }
    return rows
  }, [profileSearch, rows, skillSearch, tableName])
  const isAdminProfilesView =
    tableName === "profiles" &&
    stableFilters.some(
      (filter) => !("operator" in filter) && filter.column === "is_admin" && filter.value === true,
    )
  const tableSelectColumns = useMemo(() => {
    if (tableName === "skills") {
      const cols = columns.filter((column) => column !== "action")
      return cols.length > 0 ? cols.join(", ") : "*"
    }
    return "*"
  }, [columns, tableName])

  const rowIdentityKey = (row: Record<string, unknown>): string => {
    if (tableName === "user_reports") {
      return `user:${String(row.reporter_id ?? "")}:${String(row.reported_user_id ?? "")}:${String(row.created_at ?? "")}`
    }
    if (tableName === "product_reports") {
      return `product:${String(row.reporter_id ?? "")}:${String(row.product_id ?? "")}:${String(row.created_at ?? "")}`
    }
    return `${tableName}:${String(row.id ?? "")}`
  }

  const renderCellValue = (row: Record<string, unknown>, column: string) => {
    if (column === "action") {
      return renderActionCell(row)
    }
    if (tableName === "skills" && column === "is_published") {
      const rowKey = rowIdentityKey(row)
      const isPending = actionPendingKey === rowKey
      const isPublished = row.is_published !== false
      const selectedReason = actionReasonMap[rowKey] ?? ""
      return (
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className={`h-8 text-xs text-white disabled:opacity-60 ${
              isPublished ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-600 hover:bg-zinc-500"
            }`}
            onClick={(event) => {
              event.stopPropagation()
              void handleToggleSkillPublish(row, rowKey, selectedReason)
            }}
          >
            {isPending ? "処理中..." : isPublished ? "公開中" : "非公開"}
          </Button>
        </div>
      )
    }
    const rawValue = row[column]
    if (rawValue == null) {
      return <span className="line-clamp-2">—</span>
    }

    if (column === "dispute_status") {
      const raw = rawValue == null || String(rawValue).length === 0 ? "" : String(rawValue)
      const label = raw ? (DISPUTE_STATUS_LABEL_MAP[raw] ?? raw) : "—"
      if (!raw) {
        return <span className="text-zinc-500">—</span>
      }
      return (
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(raw)}`}>
          {label}
        </span>
      )
    }

    if (column === "status") {
      const rawStatus = String(rawValue)
      const label =
        tableName === "transactions"
          ? (TRANSACTION_STATUS_LABEL_MAP[rawStatus] ?? rawStatus)
          : (tableName === "profiles" || tableName === "admin_reported_users_summary") && rawStatus === "active"
            ? "通常"
            : (STATUS_LABEL_MAP[rawStatus] ?? rawStatus)
      return (
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(rawStatus)}`}>
          {label}
        </span>
      )
    }

    if (column.endsWith("_at")) {
      const formatted = formatDateTimeCell(rawValue)
      if (formatted) {
        return <span className="line-clamp-2">{formatted}</span>
      }
    }

    return <span className="line-clamp-2">{String(rawValue)}</span>
  }

  const handleToggleUserBan = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const reportedUserId = String(row.reported_user_id ?? "")
    if (!reportedUserId) {
      return
    }
    const currentStatus = reportedUserStatusMap[reportedUserId] === "banned" ? "banned" : "active"
    const nextStatus = currentStatus === "banned" ? "active" : "banned"
    const confirmed = window.confirm(currentStatus === "banned" ? "BANを解除しますか？" : "BANしますか？")
    if (!confirmed) {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    setActionPendingKey(rowKey)
    try {
      const { error: banError } = await supabase
        .from("profiles")
        .update({ status: nextStatus })
        .eq("id", reportedUserId)
      if (banError) {
        console.error("[AdminTableCard] profiles ban update failed:", banError)
        setNotice({ variant: "error", message: "ユーザーステータス更新に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: nextStatus === "banned" ? "ユーザーをBANしました" : "ユーザーのBANを解除しました",
      })
      await notifyAdminAction({
        recipientId: reportedUserId,
        type: "admin_user_status",
        content: `運営対応: ユーザー状態を「${nextStatus}」へ変更しました。理由: ${reason}`,
      })
      if (nextStatus === "banned") {
        void fetch("/api/notifications/event-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "user_banned",
            targetUserId: reportedUserId,
            reason,
          }),
        }).catch(() => {
          // メール通知失敗で BAN 操作を失敗扱いにしない
        })
        try {
          await fetch("/api/notifications/ban-discord", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: reportedUserId }),
            cache: "no-store",
          })
        } catch {
          // Discord 失敗は BAN 操作自体に影響しない
        }
      }
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const handleToggleProfileBan = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const userId = String(row.id ?? "")
    if (!userId) {
      return
    }
    const currentStatus = String(row.status ?? "") === "banned" ? "banned" : "active"
    const nextStatus = currentStatus === "banned" ? "active" : "banned"
    const confirmed = window.confirm(currentStatus === "banned" ? "BANを解除しますか？" : "BANしますか？")
    if (!confirmed) {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    setActionPendingKey(rowKey)
    try {
      const { error: banError } = await supabase
        .from("profiles")
        .update({ status: nextStatus })
        .eq("id", userId)
      if (banError) {
        console.error("[AdminTableCard] profiles ban update failed:", banError)
        setNotice({ variant: "error", message: "ユーザーステータス更新に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: nextStatus === "banned" ? "ユーザーをBANしました" : "ユーザーのBANを解除しました",
      })
      await notifyAdminAction({
        recipientId: userId,
        type: "admin_user_status",
        content: `運営対応: ユーザー状態を「${nextStatus}」へ変更しました。理由: ${reason}`,
      })
      if (nextStatus === "banned") {
        void fetch("/api/notifications/event-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "user_banned",
            targetUserId: userId,
            reason,
          }),
        }).catch(() => {
          // メール通知失敗で BAN 操作を失敗扱いにしない
        })
        try {
          await fetch("/api/notifications/ban-discord", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
            cache: "no-store",
          })
        } catch {
          // Discord 失敗は BAN 操作自体に影響しない
        }
      }
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const handleToggleProductPublish = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const productIdRaw = row.product_id
    const productId = typeof productIdRaw === "number" ? productIdRaw : String(productIdRaw ?? "")
    if (!productId) {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    setActionPendingKey(rowKey)
    try {
      const { data: skillRow, error: skillLoadError } = await supabase
        .from("skills")
        .select("id, is_published, user_id")
        .eq("id", productId as string | number)
        .maybeSingle<{ id: string | number; is_published: boolean | null; user_id: string | null }>()
      if (skillLoadError || !skillRow) {
        console.error("[AdminTableCard] product status load failed:", skillLoadError)
        setNotice({ variant: "error", message: "商品の状態取得に失敗しました。" })
        return
      }

      const currentPublished = skillRow.is_published !== false
      const confirmed = window.confirm(currentPublished ? "非公開にしますか？" : "公開しますか？")
      if (!confirmed) {
        return
      }
      const nextPublished = !currentPublished
      const result = await callAdminSkillModeration({
        skillId: skillRow.id,
        action: "set_published",
        isPublished: nextPublished,
        reason,
      })
      if (!result.ok) {
        console.error("[AdminTableCard] product publish toggle failed:", result.message)
        setNotice({ variant: "error", message: result.message || "商品の公開状態変更に失敗しました。" })
        return
      }

      setNotice({
        variant: "success",
        message: nextPublished ? "商品を公開しました" : "商品を非公開にしました",
      })
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const handleDeleteProduct = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const productIdRaw = row.product_id
    const productId = typeof productIdRaw === "number" ? productIdRaw : String(productIdRaw ?? "")
    if (!productId) {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    const confirmed = window.confirm("本当に実行してもよろしいですか？")
    if (!confirmed) {
      return
    }
    setActionPendingKey(rowKey)
    try {
      const result = await callAdminSkillModeration({
        skillId: productId,
        action: "delete",
        reason,
      })
      if (!result.ok) {
        console.error("[AdminTableCard] product delete failed:", result.message)
        setNotice({ variant: "error", message: result.message || "商品の削除に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: result.archived
          ? "取引履歴があるため、商品を非公開にしました（取引データは保持されます）"
          : "商品を削除しました",
      })
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const handleToggleSkillPublish = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const skillId = row.id
    if (skillId == null || skillId === "") {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    const currentPublished = row.is_published !== false
    const confirmed = window.confirm(currentPublished ? "非公開にしますか？" : "公開しますか？")
    if (!confirmed) {
      return
    }
    setActionPendingKey(rowKey)
    try {
      const nextPublished = !currentPublished
      const result = await callAdminSkillModeration({
        skillId: skillId as string | number,
        action: "set_published",
        isPublished: nextPublished,
        reason,
      })
      if (!result.ok) {
        console.error("[AdminTableCard] skill publish toggle failed:", result.message)
        setNotice({ variant: "error", message: result.message || "商品の公開状態変更に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: nextPublished ? "商品を公開しました" : "商品を非公開にしました",
      })
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const handleDeleteSkill = async (row: Record<string, unknown>, rowKey: string, reason: string) => {
    const skillId = row.id
    if (skillId == null || skillId === "") {
      return
    }
    if (!reason.trim()) {
      setNotice({ variant: "error", message: "理由を選択してください。" })
      return
    }
    const confirmed = window.confirm("本当に実行してもよろしいですか？")
    if (!confirmed) {
      return
    }
    setActionPendingKey(rowKey)
    try {
      const result = await callAdminSkillModeration({
        skillId: skillId as string | number,
        action: "delete",
        reason,
      })
      if (!result.ok) {
        console.error("[AdminTableCard] skill delete failed:", result.message)
        setNotice({ variant: "error", message: result.message || "商品の削除に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: result.archived
          ? "取引履歴があるため、商品を非公開にしました（取引データは保持されます）"
          : "商品を削除しました",
      })
      setReloadTick((prev) => prev + 1)
    } finally {
      setActionPendingKey(null)
    }
  }

  const renderActionCell = (row: Record<string, unknown>) => {
    if (tableName === "user_reports") {
      const rowKey = rowIdentityKey(row)
      const isPending = actionPendingKey === rowKey
      const reportedUserId = String(row.reported_user_id ?? "")
      const isBanned = reportedUserStatusMap[reportedUserId] === "banned"
      const selectedReason = actionReasonMap[rowKey] ?? ""
      return (
        <div className="flex min-w-[170px] flex-col gap-1" onClick={(event) => event.stopPropagation()}>
          <select
            value={selectedReason}
            onChange={(event) => updateReason(rowKey, event.target.value)}
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="">理由を選択</option>
            {ADMIN_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className={`h-8 text-xs text-white disabled:opacity-60 ${
              isBanned ? "bg-zinc-600 hover:bg-zinc-500" : "bg-red-600 hover:bg-red-500"
            }`}
            onClick={(event) => {
              event.stopPropagation()
              void handleToggleUserBan(row, rowKey, selectedReason)
            }}
          >
            {isPending ? "処理中..." : isBanned ? "BAN解除" : "BANする"}
          </Button>
        </div>
      )
    }

    if (tableName === "profiles") {
      if (isAdminProfilesView) {
        return <span className="text-zinc-500">—</span>
      }
      const rowKey = rowIdentityKey(row)
      const isPending = actionPendingKey === rowKey
      const isBanned = String(row.status ?? "") === "banned"
      const selectedReason = actionReasonMap[rowKey] ?? ""
      return (
        <div className="flex min-w-[170px] flex-col gap-1" onClick={(event) => event.stopPropagation()}>
          <select
            value={selectedReason}
            onChange={(event) => updateReason(rowKey, event.target.value)}
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="">理由を選択</option>
            {ADMIN_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className={`h-8 text-xs text-white disabled:opacity-60 ${
              isBanned ? "bg-zinc-600 hover:bg-zinc-500" : "bg-red-600 hover:bg-red-500"
            }`}
            onClick={(event) => {
              event.stopPropagation()
              void handleToggleProfileBan(row, rowKey, selectedReason)
            }}
          >
            {isPending ? "処理中..." : isBanned ? "BAN解除" : "BANする"}
          </Button>
        </div>
      )
    }

    if (tableName === "product_reports") {
      const rowKey = rowIdentityKey(row)
      const isPending = actionPendingKey === rowKey
      const productId = String(row.product_id ?? "")
      const isPublished = productPublishedMap[productId] ?? false
      const selectedReason = actionReasonMap[rowKey] ?? ""
      return (
        <div
          className="flex min-w-[220px] flex-col gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <select
            value={selectedReason}
            onChange={(event) => updateReason(rowKey, event.target.value)}
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="">理由を選択</option>
            {ADMIN_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className={`h-8 text-xs text-white disabled:opacity-60 ${
              isPublished ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-600 hover:bg-zinc-500"
            }`}
            onClick={(event) => {
              event.stopPropagation()
              void handleToggleProductPublish(row, rowKey, selectedReason)
            }}
          >
            {isPending ? "処理中..." : isPublished ? "公開中" : "非公開"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className="h-8 bg-red-700 text-xs text-white hover:bg-red-600 disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation()
              void handleDeleteProduct(row, rowKey, selectedReason)
            }}
          >
            削除
          </Button>
          </div>
        </div>
      )
    }

    if (tableName === "skills") {
      const rowKey = rowIdentityKey(row)
      const isPending = actionPendingKey === rowKey
      const selectedReason = actionReasonMap[rowKey] ?? ""
      return (
        <div className="flex min-w-[170px] flex-col gap-1" onClick={(event) => event.stopPropagation()}>
          <select
            value={selectedReason}
            onChange={(event) => updateReason(rowKey, event.target.value)}
            className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="">理由を選択</option>
            {ADMIN_REASON_OPTIONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            className="h-8 bg-red-700 text-xs text-white hover:bg-red-600 disabled:opacity-60"
            onClick={(event) => {
              event.stopPropagation()
              void handleDeleteSkill(row, rowKey, selectedReason)
            }}
          >
            {isPending ? "処理中..." : "削除"}
          </Button>
        </div>
      )
    }

    return <span className="text-zinc-500">—</span>
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setErrorMessage(null)
      setAccessDenied(false)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (cancelled) {
          return
        }
        if (authError || !authData.user?.id) {
          if (authError) {
            console.error("[AdminTableCard] auth user load error:", authError)
          }
          setAccessDenied(true)
          setRows([])
          return
        }

        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", authData.user.id)
          .maybeSingle<{ is_admin: boolean | null }>()
        if (cancelled) {
          return
        }
        if (profileError) {
          console.error("[AdminTableCard] admin profile load error:", profileError)
          setErrorMessage("データの取得に失敗しました。")
          setRows([])
          return
        }
        if (!profileRow?.is_admin) {
          setAccessDenied(true)
          setRows([])
          return
        }

        // まず * 取得でテーブル列を確認し、created_at / updated_at の存在を安全に判定する
        let probeQuery = supabase.from(tableName).select(tableSelectColumns).limit(1)
        for (const filter of stableFilters) {
          if ("operator" in filter && filter.operator === "notNull") {
            probeQuery = probeQuery.not(filter.column, "is", null)
          } else {
            const eqFilter = filter as { column: string; value: string | number | boolean }
            probeQuery = probeQuery.eq(eqFilter.column, eqFilter.value)
          }
        }
        const { data: probeData, error: probeError } = await probeQuery
        if (cancelled) {
          return
        }
        if (probeError) {
          console.error(`[AdminTableCard] ${tableName} probe error:`, probeError)
          setRows([])
          setErrorMessage("データの取得に失敗しました。")
          return
        }
        if (probeData == null) {
          console.error(`[AdminTableCard] ${tableName} probe returned null data`)
          setRows([])
          setErrorMessage("データの取得に失敗しました。")
          return
        }

        const sampleRow = Array.isArray(probeData) && probeData.length > 0 ? probeData[0] : null
        const sampleColumns = sampleRow && typeof sampleRow === "object" ? Object.keys(sampleRow) : []
        const hasCreatedAt = sampleColumns.includes("created_at")
        const hasUpdatedAt = sampleColumns.includes("updated_at")
        if (Array.isArray(probeData) && probeData.length === 0) {
          setRows([])
          return
        }

        let query = supabase.from(tableName).select(tableSelectColumns)
        for (const filter of stableFilters) {
          if ("operator" in filter && filter.operator === "notNull") {
            query = query.not(filter.column, "is", null)
          } else {
            const eqFilter = filter as { column: string; value: string | number | boolean }
            query = query.eq(eqFilter.column, eqFilter.value)
          }
        }
        if (sortBy) {
          query = query.order(sortBy, { ascending: sortAscending })
        } else if (hasCreatedAt) {
          query = query.order("created_at", { ascending: false })
        } else {
          console.warn(
            `[AdminTableCard] ${tableName}: created_at が存在しないため created_at ソートをスキップしました`,
          )
          query = query.order(orderBy, { ascending: false })
        }
        query = query.limit(limit)

        const { data, error } = await query
        if (cancelled) {
          return
        }
        if (error) {
          console.error(`[AdminTableCard] ${tableName} select error:`, error)
          setRows([])
          setErrorMessage("データの取得に失敗しました。")
          return
        }
        if (data == null) {
          console.error(`[AdminTableCard] ${tableName} select returned null data`)
          setRows([])
          setErrorMessage("データの取得に失敗しました。")
          return
        }
        const fetchedRows = data as unknown as Record<string, unknown>[]
        setRows(fetchedRows)

        if (tableName === "user_reports") {
          const targetUserIds = [...new Set(
            fetchedRows
              .map((row) => String(row.reported_user_id ?? ""))
              .filter((id) => id.length > 0),
          )]
          if (targetUserIds.length > 0) {
            const { data: profileData, error: profileLoadError } = await supabase
              .from("profiles")
              .select("id, status")
              .in("id", targetUserIds)
            if (profileLoadError) {
              console.error("[AdminTableCard] profile status load failed:", profileLoadError)
              setReportedUserStatusMap({})
            } else {
              const nextMap: Record<string, string> = {}
              for (const profile of (profileData ?? []) as Array<{ id: string; status: string | null }>) {
                nextMap[profile.id] = profile.status ?? ""
              }
              setReportedUserStatusMap(nextMap)
            }
          } else {
            setReportedUserStatusMap({})
          }
          setProductPublishedMap({})
        } else if (tableName === "product_reports") {
          const productIds = [...new Set(
            fetchedRows
              .map((row) => String(row.product_id ?? ""))
              .filter((id) => id.length > 0),
          )]
          if (productIds.length > 0) {
            const { data: skillData, error: skillLoadError } = await supabase
              .from("skills")
              .select("id, is_published")
              .in("id", productIds)
            if (skillLoadError) {
              console.error("[AdminTableCard] skills publish status load failed:", skillLoadError)
              setProductPublishedMap({})
            } else {
              const nextMap: Record<string, boolean> = {}
              for (const skill of (skillData ?? []) as Array<{ id: string | number; is_published: boolean | null }>) {
                nextMap[String(skill.id)] = skill.is_published !== false
              }
              setProductPublishedMap(nextMap)
            }
          } else {
            setProductPublishedMap({})
          }
          setReportedUserStatusMap({})
        } else {
          setReportedUserStatusMap({})
          setProductPublishedMap({})
        }
      } catch (error) {
        console.error(`[AdminTableCard] unexpected error on ${tableName}:`, error)
        if (!cancelled) {
          setRows([])
          setErrorMessage("データの取得に失敗しました。")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    columnsKey,
    filtersKey,
    limit,
    orderBy,
    reloadTick,
    sortAscending,
    sortBy,
    supabase,
    tableName,
    tableSelectColumns,
    stableFilters,
  ])

  const handleRowClick = (row: Record<string, unknown>) => {
    setSelectedItem(row)
    setDetailOpen(true)
  }

  const handleStatusChange = async (nextStatus: "pending" | "investigating" | "resolved") => {
    if (!selectedItem) {
      return
    }
    setStatusUpdating(true)
    try {
      if (tableName === "contact_submissions") {
        const contactId = selectedItem.id
        if (typeof contactId !== "number" && typeof contactId !== "string") {
          throw new Error("問い合わせIDが不正です。")
        }
        const response = await fetch("/api/admin/contact-submissions/status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: contactId, status: nextStatus }),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(payload?.error ?? "ステータス更新に失敗しました。")
        }
        setSelectedItem((prev) => (prev ? { ...prev, status: nextStatus } : prev))
        setReloadTick((prev) => prev + 1)
        return
      }

      let query = supabase.from(tableName).update({ status: nextStatus })
      if (tableName === "user_reports") {
        query = query
          .eq("reporter_id", String(selectedItem.reporter_id ?? ""))
          .eq("reported_user_id", String(selectedItem.reported_user_id ?? ""))
          .eq("created_at", String(selectedItem.created_at ?? ""))
      } else if (tableName === "product_reports") {
        query = query
          .eq("reporter_id", String(selectedItem.reporter_id ?? ""))
          .eq("product_id", Number(selectedItem.product_id))
          .eq("created_at", String(selectedItem.created_at ?? ""))
      } else if (tableName === "transactions") {
        query = query.eq("id", String(selectedItem.id ?? ""))
      } else {
        setStatusUpdating(false)
        return
      }

      const { error } = await query
      if (error) {
        console.error(`[AdminTableCard] ${tableName} status update error:`, error)
        throw error
      }
      setSelectedItem((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      setReloadTick((prev) => prev + 1)
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-sm text-zinc-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-red-500" />
            読み込み中...
          </div>
        ) : accessDenied ? (
          <p className="text-sm text-amber-300">権限がありません</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-400">{errorMessage}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">データはまだありません</p>
        ) : visibleRows.length === 0 ? (
          <p className="text-sm text-zinc-500">検索条件に一致するデータはありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {columns.map((column) => (
                    <th key={column} className="px-3 py-2 font-semibold text-zinc-300">
                      {headerLabels?.[column] ?? column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr
                    key={`${tableName}-${String(row.id ?? index)}-${index}`}
                    className="cursor-pointer border-b border-zinc-900/70 transition-colors hover:bg-zinc-900/60"
                    onClick={() => handleRowClick(row)}
                  >
                    {columns.map((column) => (
                      <td key={`${tableName}-${String(row.id ?? index)}-${column}`} className="max-w-[260px] px-3 py-2 text-zinc-200">
                        {renderCellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {tableName === "transactions" && disputeAdminDetail ? (
        <DisputeAdminDetailModal
          open={detailOpen}
          item={selectedItem}
          onClose={() => {
            setDetailOpen(false)
            setSelectedItem(null)
          }}
          onAfterMutation={() => {
            setReloadTick((prev) => prev + 1)
          }}
          onNotify={(message, variant) => {
            setNotice({ message, variant })
          }}
        />
      ) : (
        <DetailModal
          open={detailOpen}
          tableName={tableName}
          item={selectedItem}
          onClose={() => {
            setDetailOpen(false)
            setSelectedItem(null)
          }}
          onStatusChange={handleStatusChange}
          statusUpdating={statusUpdating}
        />
      )}
    </Card>
  )
}
