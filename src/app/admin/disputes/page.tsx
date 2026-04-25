import { AdminTableCard } from "@/components/admin/AdminTableCard"

const DISPUTE_HEADER_LABELS: Partial<Record<string, string>> = {
  id: "取引ID",
  seller_id: "出品者ID",
  buyer_id: "購入者ID",
  disputed_reason: "申し立て理由",
  dispute_status: "申立て対応",
  disputed_at: "申し立て日時",
  status: "ステータス",
}

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">異議申し立て</h1>
      <AdminTableCard
        title="異議申し立て一覧"
        tableName="transactions"
        columns={["id", "seller_id", "buyer_id", "disputed_reason", "dispute_status", "disputed_at", "status"]}
        filters={[
          { column: "disputed_at", operator: "notNull" },
          { column: "status", value: "disputed" },
        ]}
        sortBy="disputed_at"
        sortAscending
        orderBy="disputed_at"
        limit={500}
        headerLabels={DISPUTE_HEADER_LABELS}
        disputeAdminDetail
      />
    </div>
  )
}
