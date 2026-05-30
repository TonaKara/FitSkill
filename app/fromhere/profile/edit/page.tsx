import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { EditProfilePageClient } from "@/fromhere/profile/edit/EditProfilePageClient"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.profileEdit.metaTitle")
  return {
    title,
    /** 個人設定ページなので検索インデックスから除外する */
    robots: { index: false, follow: false },
    alternates: { canonical: "/fromhere/profile/edit" },
  }
}

export default async function Page() {
  /**
   * SSR で認証 + プロフィール作成状態を確認する。
   * Client 側 (`useFromHereAuth`) の `profile` 遅延に起因する誤リダイレクトを避けるため、
   * SSR でリダイレクトを完結させる。
   */
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/fromhere/signin?next=${encodeURIComponent("/fromhere/profile/edit")}`)
  }
  /**
   * Client 側の AuthContext 経由ではなく、SSR で `newvibes_profiles` を `select("*")` で取得して
   * **初期値として props で渡す**。`select("*")` にしているのは、`avatar_url` / `avatar_path` などの
   * カラムが存在しない古いマイグレーション環境でも SELECT エラーで edit ページが開けない事態を避けるため。
   */
  const { data: profileRow, error: profileError } = await supabase
    .from("newvibes_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    console.warn(
      "[FromHereProfileEdit] newvibes_profiles fetch failed",
      profileError.message ?? profileError,
    )
    redirect("/fromhere")
  }
  if (!profileRow) {
    redirect("/fromhere/onboarding")
  }
  const row = profileRow as Record<string, unknown>
  if (typeof row.handle !== "string" || typeof row.id !== "string") {
    redirect("/fromhere")
  }

  /** 本体 `profiles.avatar_url`（FromHere 行に avatar が無いときのフォールバック参照） */
  const { data: mainProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle()
  const mainAvatarUrl =
    typeof mainProfile?.avatar_url === "string" && mainProfile.avatar_url.trim().length > 0
      ? mainProfile.avatar_url
      : null
  const directAvatarUrl =
    typeof row.avatar_url === "string" && (row.avatar_url as string).trim().length > 0
      ? (row.avatar_url as string)
      : null

  return (
    <EditProfilePageClient
      initial={{
        id: row.id as string,
        handle: row.handle as string,
        displayName: typeof row.display_name === "string" ? (row.display_name as string) : "",
        bio: typeof row.bio === "string" ? (row.bio as string) : null,
        avatarUrl: directAvatarUrl ?? mainAvatarUrl,
        avatarPath: typeof row.avatar_path === "string" ? (row.avatar_path as string) : null,
      }}
    />
  )
}
