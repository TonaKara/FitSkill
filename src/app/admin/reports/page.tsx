"use client"

import { useMemo, useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"

const REPORT_STATUS_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "未対応" },
  { value: "investigating", label: "調査中" },
  { value: "resolved", label: "対応済み" },
] as const

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof REPORT_STATUS_OPTIONS)[number]["value"]>("all")
  const reportFilters = useMemo(
    () => (statusFilter === "all" ? [] : [{ column: "status", value: statusFilter }]),
    [statusFilter],
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">通報一覧</h1>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300" htmlFor="admin-report-status-filter">
          処理状況で絞り込み
        </label>
        <select
          id="admin-report-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as (typeof REPORT_STATUS_OPTIONS)[number]["value"])}
          className="h-10 w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {REPORT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <AdminTableCard
        title="通報一覧（ユーザー）"
        tableName="user_reports"
        columns={["reporter_id", "reported_user_id", "reason", "status", "created_at", "action"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
        filters={reportFilters}
      />
      <AdminTableCard
        title="通報一覧（商品）"
        tableName="product_reports"
        columns={["reporter_id", "product_id", "reason", "status", "created_at", "action"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
        filters={reportFilters}
      />
    </div>
  )
}
