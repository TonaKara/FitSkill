"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import type { AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { adminUi } from "@/lib/admin-ui"
import { setFromHereProductAdminHiddenAction } from "@/fromhere/_product-actions"

/** ----------------------------------------------------------
 *  /admin/posts — 投稿管理ページ
 *
 *  - FromHere 上のユーザー / プロダクトを検索し、運営判断で BAN / 非公開化を行う。
 *  - BAN は本体 `profiles.status = 'banned'` を更新する既存仕組みに合わせる。
 *    BAN されたユーザーは GritVib 本体・FromHere 双方で投稿・コメントができない
 *    (Server Action 側で BAN チェック済み)。
 *  - プロダクトの非公開化は `setFromHereProductAdminHiddenAction` を呼ぶ。
 *    `admin_hidden_at` が NOT NULL の間はユーザー側から status 変更不可。
 * ---------------------------------------------------------- */

type AdminPostsTab = "users" | "products"

const SEARCH_DEBOUNCE_MS = 250
const RESULT_LIMIT = 50

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "-"
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "-"
  }
  return parsed.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminPostsPage() {
  const [tab, setTab] = useState<AdminPostsTab>("products")

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black tracking-wide text-foreground">投稿管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          FromHere に投稿されたプロダクト / メーカーを検索し、運営判断で非公開化や BAN を行います。
          運営により非公開化されたものは、ユーザー側から復元できません。
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "products" ? "bg-red-600 text-white" : adminUi.tabInactive
          }`}
        >
          FromHere プロダクト
        </button>
        <button
          type="button"
          onClick={() => setTab("users")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "users" ? "bg-red-600 text-white" : adminUi.tabInactive
          }`}
        >
          FromHere ユーザー
        </button>
      </div>

      {tab === "products" ? <AdminProductsSearch /> : <AdminUsersSearch />}
    </div>
  )
}

/** ----------------------------------------------------------
 *  プロダクト検索 + 運営による非公開化/解除
 * ---------------------------------------------------------- */
type ProductRow = {
  id: string
  slug: string
  title: string
  status: string
  maker_id: string
  posted_at: string
  admin_hidden_at: string | null
  admin_hidden_reason: string | null
  maker_handle: string | null
}

function AdminProductsSearch() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [search])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("newvibes_products")
        .select(
          "id, slug, title, status, maker_id, posted_at, admin_hidden_at, admin_hidden_reason",
        )
        .order("posted_at", { ascending: false })
        .limit(RESULT_LIMIT)

      const q = debouncedSearch
      if (q.length > 0) {
        // title / slug / id 部分一致のいずれかでヒット
        const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
        query = query.or(`title.ilike.%${escaped}%,slug.ilike.%${escaped}%,id.eq.${q}`)
      }

      const { data, error } = await query
      if (error) {
        console.error("[admin/posts products] load failed", error)
        setNotice({ variant: "error", message: "プロダクトの取得に失敗しました。" })
        setRows([])
        return
      }
      const productRows = (data ?? []) as Omit<ProductRow, "maker_handle">[]

      // メーカー handle を補足取得
      const makerIds = Array.from(new Set(productRows.map((r) => r.maker_id))).filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      )
      const handleByMaker = new Map<string, string>()
      if (makerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("newvibes_profiles")
          .select("id, handle")
          .in("id", makerIds)
        for (const p of (profiles ?? []) as { id: string; handle: string }[]) {
          handleByMaker.set(p.id, p.handle)
        }
      }
      setRows(
        productRows.map((row) => ({
          ...row,
          maker_handle: handleByMaker.get(row.maker_id) ?? null,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, supabase])

  useEffect(() => {
    // Effect 内で直接 setState を含む関数を呼ぶことを ESLint が検知するが、
    // 検索条件 (debouncedSearch) が変わるたびにフェッチし直す本来の用途なので意図通り。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 検索条件変更時の再フェッチ
    void loadRows()
  }, [loadRows])

  const onToggleHidden = async (row: ProductRow) => {
    if (pendingId) {
      return
    }
    const nextHidden = row.admin_hidden_at == null
    const confirmMessage = nextHidden
      ? `プロダクト「${row.title}」を運営により非公開化しますか？\nユーザー側からは解除できなくなります。`
      : `プロダクト「${row.title}」の運営非公開を解除しますか？`
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) {
      return
    }
    let reason: string | null = null
    if (nextHidden) {
      reason = window.prompt("理由（任意・メモ用、500文字まで）", "") ?? null
    }
    setPendingId(row.id)
    try {
      const result = await setFromHereProductAdminHiddenAction({
        productId: row.id,
        hidden: nextHidden,
        reason,
      })
      if (!result.ok) {
        console.error("[admin/posts products] toggle failed", result.error)
        setNotice({
          variant: "error",
          message:
            result.error === "forbidden"
              ? "権限がありません。"
              : result.error === "not_found"
                ? "プロダクトが見つかりませんでした。"
                : "操作に失敗しました。",
        })
        return
      }
      setNotice({
        variant: "success",
        message: nextHidden
          ? "プロダクトを運営により非公開化しました。"
          : "プロダクトの運営非公開を解除しました。",
      })
      await loadRows()
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="space-y-2">
        <label className={adminUi.label} htmlFor="admin-posts-product-search">
          検索（タイトル / slug / プロダクトID）
        </label>
        <Input
          id="admin-posts-product-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトル / slug / ID の一部で絞り込み"
          className={adminUi.filterInput}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">タイトル</th>
              <th className="px-3 py-2 text-left">メーカー</th>
              <th className="px-3 py-2 text-left">状態</th>
              <th className="px-3 py-2 text-left">公開日時</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  該当するプロダクトがありません。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isHidden = row.admin_hidden_at != null
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">{row.title}</div>
                      <div className="text-xs text-muted-foreground">/{row.slug}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {row.maker_handle ? `@${row.maker_handle}` : (
                        <span className="text-muted-foreground">未設定</span>
                      )}
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                        {row.maker_id}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{row.status}</div>
                      {isHidden ? (
                        <div className="mt-1 inline-block rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-300">
                          運営により非公開
                        </div>
                      ) : null}
                      {isHidden && row.admin_hidden_reason ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          理由: {row.admin_hidden_reason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.posted_at)}</td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isHidden ? "outline" : "destructive"}
                        disabled={pendingId === row.id}
                        onClick={() => void onToggleHidden(row)}
                      >
                        {pendingId === row.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        {isHidden ? "非公開を解除" : "非公開にする"}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** ----------------------------------------------------------
 *  FromHere ユーザー検索 + BAN
 * ---------------------------------------------------------- */
type FromHereUserRow = {
  id: string
  handle: string
  display_name: string
  created_at: string
  status: string | null
  is_banned: boolean | null
  custom_id: string | null
}

function AdminUsersSearch() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [rows, setRows] = useState<FromHereUserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [search])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from("newvibes_profiles")
        .select("id, handle, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(RESULT_LIMIT)

      const q = debouncedSearch
      if (q.length > 0) {
        const escaped = q.replace(/[%_]/g, (m) => `\\${m}`)
        query = query.or(
          `handle.ilike.%${escaped}%,display_name.ilike.%${escaped}%,id.eq.${q}`,
        )
      }

      const { data, error } = await query
      if (error) {
        console.error("[admin/posts users] load failed", error)
        setNotice({ variant: "error", message: "ユーザーの取得に失敗しました。" })
        setRows([])
        return
      }
      const fromHereRows = (data ?? []) as {
        id: string
        handle: string
        display_name: string
        created_at: string
      }[]

      // 本体 profiles から BAN 状態と custom_id を取得
      const ids = fromHereRows.map((r) => r.id)
      const profilesById = new Map<
        string,
        { status: string | null; is_banned: boolean | null; custom_id: string | null }
      >()
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, status, is_banned, custom_id")
          .in("id", ids)
        for (const row of (profiles ?? []) as {
          id: string
          status: string | null
          is_banned: boolean | null
          custom_id: string | null
        }[]) {
          profilesById.set(row.id, {
            status: row.status ?? null,
            is_banned: row.is_banned ?? null,
            custom_id: row.custom_id ?? null,
          })
        }
      }

      setRows(
        fromHereRows.map((row) => ({
          ...row,
          status: profilesById.get(row.id)?.status ?? null,
          is_banned: profilesById.get(row.id)?.is_banned ?? null,
          custom_id: profilesById.get(row.id)?.custom_id ?? null,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, supabase])

  useEffect(() => {
    // 検索条件変更時の再フェッチ（同上）。
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 検索条件変更時の再フェッチ
    void loadRows()
  }, [loadRows])

  const isBanned = (row: FromHereUserRow): boolean =>
    (row.status ?? "").trim() === "banned" || Boolean(row.is_banned)

  const onToggleBan = async (row: FromHereUserRow) => {
    if (pendingId) {
      return
    }
    const currentlyBanned = isBanned(row)
    const nextStatus = currentlyBanned ? "active" : "banned"
    const confirmed = window.confirm(
      currentlyBanned
        ? `@${row.handle} の BAN を解除しますか？`
        : `@${row.handle} を BAN しますか？\nBAN されたユーザーは GritVib 本体および FromHere で投稿・コメント等の操作ができなくなります。`,
    )
    if (!confirmed) {
      return
    }
    setPendingId(row.id)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: nextStatus })
        .eq("id", row.id)
      if (error) {
        console.error("[admin/posts users] ban toggle failed", error)
        setNotice({ variant: "error", message: "BAN 操作に失敗しました。" })
        return
      }
      setNotice({
        variant: "success",
        message: nextStatus === "banned" ? "ユーザーを BAN しました。" : "ユーザーの BAN を解除しました。",
      })
      await loadRows()
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="space-y-4">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="space-y-2">
        <label className={adminUi.label} htmlFor="admin-posts-user-search">
          検索（ハンドル / 表示名 / ユーザーID）
        </label>
        <Input
          id="admin-posts-user-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ハンドル / 表示名 / ID の一部で絞り込み"
          className={adminUi.filterInput}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ハンドル</th>
              <th className="px-3 py-2 text-left">表示名</th>
              <th className="px-3 py-2 text-left">本体ハンドル(custom_id)</th>
              <th className="px-3 py-2 text-left">登録日時</th>
              <th className="px-3 py-2 text-left">BAN 状態</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  該当するユーザーがいません。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const banned = isBanned(row)
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">@{row.handle}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground/80">
                        {row.id}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">{row.display_name}</td>
                    <td className="px-3 py-2 text-foreground">
                      {row.custom_id ? `@${row.custom_id}` : <span className="text-muted-foreground">未設定</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">
                      {banned ? (
                        <span className="inline-block rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-300">
                          BAN 中
                        </span>
                      ) : (
                        <span className="text-muted-foreground">通常</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={banned ? "outline" : "destructive"}
                        disabled={pendingId === row.id}
                        onClick={() => void onToggleBan(row)}
                      >
                        {pendingId === row.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : null}
                        {banned ? "BAN を解除" : "BAN する"}
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
