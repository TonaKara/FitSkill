"use client"

import { useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { Input } from "@/components/ui/input"

type UserTab = "admins" | "general" | "reported"

const PROFILE_COLUMNS = ["id", "display_name", "status", "action"] as const

const PROFILE_HEADER_LABELS: Partial<Record<(typeof PROFILE_COLUMNS)[number], string>> = {
  id: "ユーザーID",
  display_name: "表示名",
  status: "状態",
  action: "操作",
}

const REPORTED_USERS_COLUMNS = [
  "reported_user_id",
  "display_name",
  "status",
  "report_count",
  "last_reported_at",
] as const

const REPORTED_USERS_HEADER_LABELS: Partial<Record<(typeof REPORTED_USERS_COLUMNS)[number], string>> = {
  reported_user_id: "被通報ユーザーID",
  display_name: "表示名",
  status: "状態",
  report_count: "通報件数",
  last_reported_at: "最終通報日時",
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState<UserTab>("general")
  const [search, setSearch] = useState("")

  const adminFilter = [{ column: "is_admin", value: true }] as const
  const generalFilter = [{ column: "is_admin", value: false }] as const

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">ユーザー管理</h1>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300" htmlFor="admin-user-search">
          検索（ユーザーID・表示名）
        </label>
        <Input
          id="admin-user-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ユーザーID または 表示名の一部で絞り込み"
          className="max-w-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("admins")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "admins"
              ? "bg-red-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          管理者一覧
        </button>
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "general"
              ? "bg-red-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          一般ユーザー一覧
        </button>
        <button
          type="button"
          onClick={() => setTab("reported")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "reported"
              ? "bg-red-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          通報が多いユーザー
        </button>
      </div>

      {tab === "admins" ? (
        <AdminTableCard
          key="admin-users-admins"
          title="管理者一覧"
          tableName="profiles"
          columns={[...PROFILE_COLUMNS]}
          orderBy="id"
          limit={500}
          filters={[...adminFilter]}
          headerLabels={PROFILE_HEADER_LABELS}
          profileSearch={search}
        />
      ) : tab === "general" ? (
        <AdminTableCard
          key="admin-users-general"
          title="一般ユーザー一覧"
          tableName="profiles"
          columns={[...PROFILE_COLUMNS]}
          orderBy="id"
          limit={500}
          filters={[...generalFilter]}
          headerLabels={PROFILE_HEADER_LABELS}
          profileSearch={search}
        />
      ) : (
        <AdminTableCard
          key="admin-users-reported"
          title="通報が多いユーザー"
          tableName="admin_reported_users_summary"
          columns={[...REPORTED_USERS_COLUMNS]}
          sortBy="report_count"
          sortAscending={false}
          limit={500}
          headerLabels={REPORTED_USERS_HEADER_LABELS}
          profileSearch={search}
        />
      )}
    </div>
  )
}
