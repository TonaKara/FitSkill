import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">通報一覧</h1>
      <AdminTableCard
        title="通報一覧（ユーザー）"
        tableName="user_reports"
        columns={["reporter_id", "reported_user_id", "reason", "status", "created_at", "action"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
      <AdminTableCard
        title="通報一覧（商品）"
        tableName="product_reports"
        columns={["reporter_id", "product_id", "reason", "status", "created_at", "action"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
    </div>
  )
}
