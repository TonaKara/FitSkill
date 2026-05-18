"use client"

import { useMemo, useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { adminUi } from "@/lib/admin-ui"
import { cn } from "@/lib/utils"

const DISPUTE_HEADER_LABELS: Partial<Record<string, string>> = {
  id: "取引ID",
  seller_id: "出品者ID",
  buyer_id: "購入者ID",
  disputed_reason: "申し立て理由",
  dispute_status: "申立て対応",
  disputed_at: "申し立て日時",
  status: "ステータス",
}

const DISPUTE_STATUS_OPTIONS = [
  { value: "all", label: "すべて" },
  { value: "open", label: "対応待ち" },
  { value: "resolved", label: "承認（返金済）" },
  { value: "rejected", label: "棄却（完了）" },
] as const

type AdminDisputesTableSectionProps = {
  filterLabel?: string
  sortByDisputedAt?: boolean
}

export function AdminDisputesTableSection({
  filterLabel = "処理状況で絞り込み",
  sortByDisputedAt = true,
}: AdminDisputesTableSectionProps) {
  const [disputeStatusFilter, setDisputeStatusFilter] =
    useState<(typeof DISPUTE_STATUS_OPTIONS)[number]["value"]>("all")
  const disputeFilters = useMemo(() => {
    const baseFilters: Array<{ column: string; value: string } | { column: string; operator: "notNull" }> = [
      { column: "disputed_at", operator: "notNull" },
    ]
    if (disputeStatusFilter === "all") {
      return baseFilters
    }
    return [...baseFilters, { column: "dispute_status", value: disputeStatusFilter }]
  }, [disputeStatusFilter])
  const tableSortProps = sortByDisputedAt
    ? { sortBy: "disputed_at" as const, sortAscending: true, orderBy: "disputed_at" as const }
    : {}

  return (
    <>
      <div className="space-y-3">
        <label className={adminUi.label} htmlFor="admin-dispute-status-filter">
          {filterLabel}
        </label>
        <select
          id="admin-dispute-status-filter"
          value={disputeStatusFilter}
          onChange={(event) =>
            setDisputeStatusFilter(event.target.value as (typeof DISPUTE_STATUS_OPTIONS)[number]["value"])
          }
          className={cn("w-full max-w-xs", adminUi.select)}
        >
          {DISPUTE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <AdminTableCard
        title="異議申し立て一覧"
        tableName="transactions"
        columns={["id", "seller_id", "buyer_id", "disputed_reason", "dispute_status", "disputed_at", "status"]}
        filters={disputeFilters}
        {...tableSortProps}
        limit={500}
        headerLabels={DISPUTE_HEADER_LABELS}
        disputeAdminDetail
      />
    </>
  )
}
