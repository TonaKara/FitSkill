import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { ADMIN_TABLE_HEADER_LABELS } from "@/lib/admin-table-labels"

export default function AdminContactsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">問い合わせ一覧</h1>
      <AdminTableCard
        title="問い合わせ一覧（最新）"
        tableName="contact_submissions"
        columns={["name", "email", "category", "subject", "status", "created_at"]}
        headerLabels={ADMIN_TABLE_HEADER_LABELS}
      />
    </div>
  )
}
