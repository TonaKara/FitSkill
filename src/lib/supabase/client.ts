import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

/**
 * ブラウザ用 Supabase クライアント。
 * `@supabase/ssr` の `createBrowserClient` により、セッションが Cookie にも保持され、
 * Server Actions / Route Handler の `createServerClient` と同じセッションを共有できる。
 * （`@supabase/supabase-js` の `createClient` だけだと主に localStorage になり、サーバー側は未ログインになる）
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase環境変数が不足しています")
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  })
  return browserClient
}
