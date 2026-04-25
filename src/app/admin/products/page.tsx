"use client"

import { useState } from "react"
import { AdminTableCard } from "@/components/admin/AdminTableCard"
import { Input } from "@/components/ui/input"

const SKILL_COLUMNS = [
  "id",
  "user_id",
  "title",
  "category",
  "price",
  "is_published",
  "created_at",
  "action",
] as const

const SKILL_HEADER_LABELS: Partial<Record<(typeof SKILL_COLUMNS)[number], string>> = {
  id: "商品ID",
  user_id: "ユーザーID",
  title: "タイトル",
  category: "カテゴリー",
  price: "価格",
  is_published: "公開状態",
  created_at: "作成日時",
  action: "操作",
}

export default function AdminProductsPage() {
  const [search, setSearch] = useState("")

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-wide text-white">商品管理</h1>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300" htmlFor="admin-skill-search">
          検索（商品ID・タイトル）
        </label>
        <Input
          id="admin-skill-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="商品ID または タイトルの一部で絞り込み"
          className="max-w-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <AdminTableCard
        title="商品一覧"
        tableName="skills"
        columns={[...SKILL_COLUMNS]}
        orderBy="created_at"
        limit={500}
        headerLabels={SKILL_HEADER_LABELS}
        skillSearch={search}
      />
    </div>
  )
}
