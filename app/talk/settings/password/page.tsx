import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { ChangePasswordPage } from "@/talk/_change-password"
import {
  GRITVIB_LOGIN_PATH,
  GRITVIB_ONBOARD_PATH,
  resolveTalkPasswordChangeReturnPath,
} from "@/lib/talk/post-auth-redirect"

export const metadata: Metadata = {
  title: { absolute: "パスワードを変更 | GritVib" },
  alternates: { canonical: "/talk/settings/password" },
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * ログイン中会員（管理者含む）のパスワード変更。
 * 管理者も利用可だが、チャット画面とは別 URL（管理者は /talk/admin から遷移）。
 */
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
    redirect(GRITVIB_LOGIN_PATH)
  }

  const { data: isMember, error: memberError } = await supabase.rpc(
    "gritvib_chat_self_is_member",
  )
  if (memberError || !isMember) {
    redirect(GRITVIB_ONBOARD_PATH)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  const isAdmin = profile?.is_admin === true

  return (
    <ChangePasswordPage
      isAdmin={isAdmin}
      returnPath={resolveTalkPasswordChangeReturnPath(isAdmin)}
    />
  )
}
