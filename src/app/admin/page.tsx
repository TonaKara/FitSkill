import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { AdminAnnouncementForm } from "@/components/admin/AdminAnnouncementForm"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">ダッシュボード</h1>
      <AdminAnnouncementForm />
      <AdminTableCard
        title="問い合わせ一覧（最新）"
        tableName="contact_submissions"
        columns={["name", "email", "category", "subject", "status", "created_at"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
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
