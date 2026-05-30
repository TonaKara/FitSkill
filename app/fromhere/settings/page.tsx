import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import {
  SettingsPageClient,
  type SettingsInitialProfile,
} from "@/fromhere/settings/SettingsPageClient"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/** 設定ページは個人情報を含むため毎リクエストで取得し、検索インデックスにも乗せない。 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.settings.metaTitle")
  return {
    title,
    robots: { index: false, follow: false },
  }
}

export default async function Page() {
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
    redirect(`/fromhere/signin?next=${encodeURIComponent("/fromhere/settings")}`)
  }

  /**
   * プロフィール初期値の SSR fetch。
   * - `newvibes_profiles` を正本として取得（`select("*")` でカラム不一致に強い形）。
   * - SELECT がエラー / 行なしの場合は `/fromhere/onboarding` に飛ばす。
   * - avatar は newvibes_profiles 優先、空なら本体 `profiles.avatar_url` をフォールバック。
   */
  const { data: profileRow, error: profileError } = await supabase
    .from("newvibes_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    console.warn(
      "[FromHereSettings] newvibes_profiles fetch failed",
      profileError.message ?? profileError,
    )
    redirect("/fromhere")
  }
  if (!profileRow) {
    redirect("/fromhere/onboarding")
  }
  const row = profileRow as Record<string, unknown>
  if (typeof row.handle !== "string" || typeof row.id !== "string") {
    /** 必須列が欠落している環境は救えないのでホームへ */
    redirect("/fromhere")
  }
  const directAvatar =
    typeof row.avatar_url === "string" && (row.avatar_url as string).trim().length > 0
      ? (row.avatar_url as string)
      : null
  let avatarUrl: string | null = directAvatar
  if (!avatarUrl) {
    const { data: mainProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
    if (mainProfile && typeof mainProfile.avatar_url === "string") {
      const main = (mainProfile.avatar_url as string).trim()
      if (main.length > 0) {
        avatarUrl = main
      }
    }
  }
  const initialProfile: SettingsInitialProfile = {
    id: row.id as string,
    handle: row.handle as string,
    displayName: typeof row.display_name === "string" ? (row.display_name as string) : "",
    bio: typeof row.bio === "string" ? (row.bio as string) : null,
    avatarUrl,
  }

  return <SettingsPageClient initialEmail={user.email ?? ""} initialProfile={initialProfile} />
}
