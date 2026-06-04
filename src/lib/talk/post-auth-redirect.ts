import type { SupabaseClient } from "@supabase/supabase-js"

export const GRITVIB_LOGIN_PATH = "/talk/login"
export const GRITVIB_ONBOARD_PATH = "/talk/onboard"
export const GRITVIB_CHAT_PATH = "/talk/chat"
export const GRITVIB_ADMIN_PATH = "/talk/admin"

/** パスワード変更完了後の戻り先（管理者は管理画面、会員はチャット）。 */
export function resolveTalkPasswordChangeReturnPath(isAdmin: boolean): string {
  return isAdmin ? GRITVIB_ADMIN_PATH : GRITVIB_CHAT_PATH
}

/**
 * ログイン / オンボード完了後の遷移先。
 * 管理者（profiles.is_admin）かつ会員登録済みなら管理画面、それ以外は従来どおり。
 */
export async function resolveGritvibPostAuthPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: isMember, error: memberError } = await supabase.rpc(
    "gritvib_chat_self_is_member",
  )
  if (memberError) {
    return GRITVIB_ONBOARD_PATH
  }

  if (!isMember) {
    return GRITVIB_ONBOARD_PATH
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle()

  if (profile?.is_admin === true) {
    return GRITVIB_ADMIN_PATH
  }

  return GRITVIB_CHAT_PATH
}
