import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { ChatPage } from "@/talk/_chat"
import {
  GRITVIB_ADMIN_PATH,
  resolveGritvibPostAuthPath,
} from "@/lib/talk/post-auth-redirect"

export const metadata: Metadata = {
  title: { absolute: "チャット | GritVib" },
  alternates: { canonical: "/talk/chat" },
  robots: { index: false, follow: false },
}

/**
 * GritVib のチャット画面エントリ。
 *
 * 認可方針:
 *   - 未ログイン → `/talk/login`
 *   - ログイン済みで `gritvib_chat_members` レコードなし → `/talk/onboard`
 *   - 管理者 → `/talk/admin`
 *   - 上記以外で会員あり → <ChatPage /> を描画
 *
 * 注: サブスクリプション未加入でも画面は開ける（送信のみ制限）。
 * これは「課金していなくてもチャット画面に行ける、ただし送信できない」要件のため。
 */
export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
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
    redirect("/talk/login")
  }

  const { data: profileRows, error: profileError } = await supabase.rpc(
    "gritvib_chat_self_member_profile",
  )
  if (profileError) {
    redirect("/talk/onboard")
  }
  const member = Array.isArray(profileRows) ? profileRows[0] : null
  if (!member?.id) {
    redirect("/talk/onboard")
  }

  const postAuthPath = await resolveGritvibPostAuthPath(supabase, user.id)
  if (postAuthPath === GRITVIB_ADMIN_PATH) {
    redirect(GRITVIB_ADMIN_PATH)
  }

  /** 管理画面リンク表示用（一般会員が管理者になった場合の保険）。 */
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  const isAdmin = profile?.is_admin === true

  /**
   * `useSearchParams` を内部で使うクライアントコンポーネントは Suspense でラップする
   * 必要がある (Next.js の要件)。fallback は最小限のブランクで OK。
   */
  return (
    <Suspense fallback={null}>
      <ChatPage
        key={user.id}
        userId={user.id}
        nickname={member.nickname}
        accountEmail={user.email ?? ""}
        isAdmin={isAdmin}
      />
    </Suspense>
  )
}
