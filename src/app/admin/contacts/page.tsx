"use client"

import { useMemo, useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"
import { adminUi } from "@/lib/admin-ui"
import { cn } from "@/lib/utils"

const CONTACT_STATUS_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "pending", label: "未対応" },
  { value: "investigating", label: "調査中" },
  { value: "resolved", label: "対応済み" },
] as const

export default function AdminContactsPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof CONTACT_STATUS_OPTIONS)[number]["value"]>("all")
  const contactFilters = useMemo(
    () => (statusFilter === "all" ? [] : [{ column: "status", value: statusFilter }]),
    [statusFilter],
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-foreground">問い合わせ一覧</h1>
      <div className="space-y-3">
        <label className={adminUi.label} htmlFor="admin-contact-status-filter">
          処理状況で絞り込み
        </label>
        <select
          id="admin-contact-status-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as (typeof CONTACT_STATUS_OPTIONS)[number]["value"])}
          className={cn("w-full max-w-xs", adminUi.select)}
        >
          {CONTACT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <AdminTableCard
        title="問い合わせ一覧（最新）"
        tableName="contact_submissions"
        columns={[
          "name",
          "email",
          "submitter_profile_id",
          "category",
          "subject",
          "transaction_id",
          "status",
          "created_at",
        ]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
        filters={contactFilters}
      />
    </div>
  )
}
