import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service Role キーで動作する Supabase クライアント。
 *
 * - 用途: Route Handler / Server Action 内で **明示的に RLS をバイパスする**必要がある書き込み。
 *   （例: 集計列の整合更新、トリガに依存しない count 更新、運営権限での操作 等）
 * - セッションは持たせない (`persistSession: false`)。複数リクエスト間で状態を共有しない。
 * - 必ずユーザー認証や権限チェックを別途行ったうえで使うこと。直接エンドユーザーの入力で
 *   呼ばれる操作にそのまま渡してはいけない。
 *
 * 環境変数 (`SUPABASE_SERVICE_ROLE_KEY` / URL) が無い場合は `null` を返し、呼び出し側で
 *   通常クライアントへのフォールバックを行えるようにする。
 */
let cachedAdminClient: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedAdminClient) {
    return cachedAdminClient
  }
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return null
  }
  cachedAdminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdminClient
}
