import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  FromHereAuthProvider,
  type FromHereAuthInitial,
  type FromHereProfile,
} from "@/fromhere/_auth-context"
import { FromHereHeader } from "@/fromhere/_chrome"
import { FromHereScrollReset } from "@/fromhere/_scroll-reset"

/**
 * /fromhere 配下に専用ヘッダーを適用するレイアウト。
 *
 * - SSR でユーザー + プロフィールを取得して `FromHereAuthProvider` に初期値を渡し、
 *   初回描画からヘッダー右の表示名 / アバターが正しく出るようにする。
 * - 共通サイトヘッダーは `shouldShowSiteHeader` で `/fromhere` を除外しているため、
 *   この `FromHereHeader` だけが画面上部に表示される。
 * - 共通フッターは `ConditionalFooter` 側で引き続き表示する。
 * - `FromHereScrollReset` でページ遷移／リロード時のスクロール位置を必ず先頭にリセットする。
 */
export default async function FromHereLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initial = await loadFromHereAuthInitial()
  return (
    <FromHereAuthProvider initial={initial}>
      <FromHereScrollReset />
      <div className="flex w-full min-w-0 flex-1 flex-col bg-background text-foreground">
        <FromHereHeader />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </FromHereAuthProvider>
  )
}

/**
 * SSR で `newvibes_profiles` を最優先に読み、本体 `profiles.avatar_url` をフォールバック参照する。
 *
 * - 認証 cookie からセッションを復元できない場合は `user: null` のまま返す（匿名閲覧）。
 * - 必須カラム（id / handle / display_name）の SELECT のみで profile 判定し、
 *   `bio` / `avatar_url` / `avatar_path` は別クエリで取得する。
 *   古い DB スキーマで avatar 系カラムが無くてもプロフィール本体は失われない。
 * - DB 読み出しに失敗しても画面全体は描画する。
 */
async function loadFromHereAuthInitial(): Promise<FromHereAuthInitial> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options)
              } catch {
                /* RSC で set できない場面は無視（読み取り目的のため） */
              }
            })
          },
        },
      },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { user: null, profile: null }
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("newvibes_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()
    if (profileError) {
      console.warn(
        "[FromHereLayout] newvibes_profiles fetch failed",
        profileError.message ?? profileError,
      )
      return { user: { id: user.id, email: user.email ?? undefined }, profile: null }
    }
    if (!profileRow) {
      console.info(
        "[FromHereLayout] newvibes_profiles row not found for uid=",
        user.id,
      )
      return { user: { id: user.id, email: user.email ?? undefined }, profile: null }
    }
    const row = profileRow as Record<string, unknown>
    let avatarUrl =
      typeof row.avatar_url === "string" && (row.avatar_url as string).trim().length > 0
        ? (row.avatar_url as string)
        : null
    const avatarPath = typeof row.avatar_path === "string" ? (row.avatar_path as string) : null
    /**
     * 本体 `profiles` から `avatar_url` (フォールバック) と `is_admin` (管理者判定) を
     * 1 クエリで取得する。失敗しても画面全体は描画する。
     */
    let isAdmin = false
    {
      const { data: mainProfile } = await supabase
        .from("profiles")
        .select("avatar_url, is_admin")
        .eq("id", user.id)
        .maybeSingle()
      if (mainProfile) {
        if (!avatarUrl && typeof mainProfile.avatar_url === "string") {
          const main = (mainProfile.avatar_url as string).trim()
          if (main.length > 0) {
            avatarUrl = main
          }
        }
        if (typeof mainProfile.is_admin === "boolean") {
          isAdmin = mainProfile.is_admin
        }
      }
    }
    const profile: FromHereProfile = {
      id: typeof row.id === "string" ? row.id : (row.id as string),
      handle: typeof row.handle === "string" ? row.handle : "",
      display_name: typeof row.display_name === "string" ? row.display_name : "",
      bio: typeof row.bio === "string" ? (row.bio as string) : null,
      avatar_url: avatarUrl,
      avatar_path: avatarPath,
    }
    return { user: { id: user.id, email: user.email ?? undefined }, profile, isAdmin }
  } catch (err) {
    console.warn("[FromHereLayout] loadFromHereAuthInitial threw", err)
    return { user: null, profile: null }
  }
}
