import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import FromHereSubmitPage from "@/fromhere/submit/page"
import { getDictionary, lookupMessage } from "@/lib/i18n/dictionaries"
import { getServerLocale } from "@/lib/i18n/server-detect"

/**
 * 投稿ページは個人状態（認証 + プロフィール作成済み）の検証が必須なので
 * 毎リクエストで実行し、検索インデックスにも乗せない。
 */
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale()
  const dict = getDictionary(locale)
  const title = lookupMessage(dict, "fromhere.submit.title")
  const description = lookupMessage(dict, "fromhere.submit.subtitle")
  return {
    title,
    description,
    alternates: { canonical: "/fromhere/submit" },
    robots: { index: false, follow: false },
    openGraph: { url: "/fromhere/submit", title, description },
  }
}

export default async function Page() {
  /**
   * SSR で認証 + プロフィール作成状態を確認する。
   *
   * Client Component の `useFromHereAuth().profile` は `onAuthStateChange` 後に
   * 一瞬 `null` になる瞬間があり、その間にクライアント側で onboarding へ自動遷移
   * してしまうと「一瞬投稿ページが見えてから登録画面に切り替わる」状態になる。
   * SSR で確実に判定することで、profile 作成済みユーザーはそのまま投稿フォームを開ける。
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
    redirect(`/fromhere/signin?next=${encodeURIComponent("/fromhere/submit")}`)
  }
  const { data: profileRow, error: profileError } = await supabase
    .from("newvibes_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    // DB アクセス失敗は最小限の情報のみクライアントに伝え、UI 側で再試行できるようにする。
    // ただし投稿フォームを表示しても操作不能になるだけなので、ホームへ戻す。
    redirect("/fromhere")
  }
  if (!profileRow) {
    redirect("/fromhere/onboarding")
  }
  return (
    <Suspense fallback={null}>
      <FromHereSubmitPage />
    </Suspense>
  )
}
