"use client"

import { useCallback, useState } from "react"
import { AdminAnnouncementForm } from "@/components/admin/AdminAnnouncementForm"
import { AdminAnnouncementsList } from "@/components/admin/AdminAnnouncementsList"

export default function AdminAnnouncementsPage() {
  const [reloadToken, setReloadToken] = useState(0)
  const handleSent = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-foreground">お知らせ</h1>
      <AdminAnnouncementForm onSent={handleSent} />
      <AdminAnnouncementsList reloadToken={reloadToken} />
    </div>
  )
}
