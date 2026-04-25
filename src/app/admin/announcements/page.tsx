import { AdminAnnouncementForm } from "@/components/admin/AdminAnnouncementForm"
import { AdminAnnouncementsList } from "@/components/admin/AdminAnnouncementsList"

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">お知らせ</h1>
      <AdminAnnouncementForm />
      <AdminAnnouncementsList />
    </div>
  )
}

