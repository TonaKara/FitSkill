import type { SupabaseClient } from "@supabase/supabase-js"
import { getIsAdminFromProfile } from "@/lib/admin"

/**
 * settings のメンテナンスフラグを取得する（失敗時はオフ扱いでサイトを閉じ込めない）
 */
export async function fetchIsMaintenanceEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.from("settings").select("is_maintenance").maybeSingle<{
    is_maintenance: boolean | null
  }>()
  if (error) {
    console.error("[maintenance-access] settings 取得エラー:", error)
    return false
  }
  return Boolean(data?.is_maintenance)
}

/**
 * 公開向け: メンテナンス中かつ「現在のユーザーが管理者でない」ならメンテナンス画面へ誘導すべきか。
 *
 * イメージ: `if (settings.is_maintenance && !user.is_admin) { redirect('/maintenance') }`
 */
export async function shouldRedirectPublicUserToMaintenance(
  supabase: SupabaseClient,
): Promise<boolean> {
  const maintenanceOn = await fetchIsMaintenanceEnabled(supabase)
  if (!maintenanceOn) {
    return false
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return true
  }

  const isAdmin = await getIsAdminFromProfile(supabase, user.id)
  return !isAdmin
}
