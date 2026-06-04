import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { AdminChatPage } from "@/talk/admin/_chat"
import { listGritvibAdminThreadsAction } from "@/talk/admin/_actions"
import { listGritvibInquiriesAction } from "@/talk/admin/_inquiry-actions"

export const metadata: Metadata = {
  title: { absolute: "管理画面 | GritVib" },
  alternates: { canonical: "/talk/admin" },
  robots: { index: false, follow: false },
}

/**
 * GritVib 管理画面エントリ。
 *
 * 認可:
 *   - 未ログイン → `/talk/login`
 *   - 会員でない → `/talk/onboard`
 *   - `profiles.is_admin = true` でない → `/talk/chat` (静かに戻す)
 *
 * 初期描画は server side でスレッド一覧を取得して props で渡し、その後の
 * 再取得 / リアルタイム反映はクライアント側 (`AdminChatPage`) で行う。
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (profile?.is_admin !== true) {
    redirect("/talk/chat")
  }

  const initial = await listGritvibAdminThreadsAction()
  const initialThreads = initial.ok ? initial.threads : []

  const inquiriesInitial = await listGritvibInquiriesAction({ status: "all" })
  const initialInquiryPendingCount = inquiriesInitial.ok ? inquiriesInitial.pendingCount : 0

  return (
    <Suspense fallback={null}>
      <AdminChatPage
        adminUserId={user.id}
        adminNickname={member.nickname}
        initialThreads={initialThreads}
        initialInquiryPendingCount={initialInquiryPendingCount}
      />
    </Suspense>
  )
}
