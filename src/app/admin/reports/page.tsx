"use client"

import { useMemo, useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"
import { adminUi } from "@/lib/admin-ui"
import { cn } from "@/lib/utils"

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
      <h1 className="text-3xl font-black tracking-wide text-foreground">通報一覧</h1>
      <div className="space-y-3">
        <label className={adminUi.label} htmlFor="admin-report-status-filter">
          処理状況で絞り込み
        </label>
        <select
          id="admin-report-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as (typeof REPORT_STATUS_OPTIONS)[number]["value"])}
          className={cn("w-full max-w-xs", adminUi.select)}
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
