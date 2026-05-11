"use client"

import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { AdminAnnouncementForm } from "@/components/admin/AdminAnnouncementForm"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"

const DISPUTE_HEADER_LABELS: Partial<Record<string, string>> = {
  id: "取引ID",
  seller_id: "出品者ID",
  buyer_id: "購入者ID",
  disputed_reason: "申し立て理由",
  dispute_status: "申立て対応",
  disputed_at: "申し立て日時",
  status: "ステータス",
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">ダッシュボード</h1>
      <AdminAnnouncementForm />
      <AdminTableCard
        title="異議申し立て一覧"
        tableName="transactions"
        columns={["id", "seller_id", "buyer_id", "disputed_reason", "dispute_status", "disputed_at", "status"]}
        filters={[
          { column: "disputed_at", operator: "notNull" },
          { column: "dispute_status", value: "open" },
        ]}
        limit={500}
        sortBy="disputed_at"
        sortAscending
        headerLabels={DISPUTE_HEADER_LABELS}
        disputeAdminDetail
      />
      <AdminTableCard
        title="問い合わせ一覧"
        tableName="contact_submissions"
        columns={["name", "email", "category", "subject", "status", "created_at"]}
        filters={[{ column: "status", value: "pending" }]}
        sortBy="created_at"
        sortAscending
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
      <AdminTableCard
        title="通報一覧（ユーザー）"
        tableName="user_reports"
        columns={["reporter_id", "reported_user_id", "reason", "status", "created_at", "action"]}
        filters={[{ column: "status", value: "pending" }]}
        sortBy="created_at"
        sortAscending
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
      <AdminTableCard
        title="通報一覧（商品）"
        tableName="product_reports"
        columns={["reporter_id", "product_id", "reason", "status", "created_at", "action"]}
        filters={[{ column: "status", value: "pending" }]}
        sortBy="created_at"
        sortAscending
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
    </div>
  )
}
