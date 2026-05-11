import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | null = null

const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co"
const PLACEHOLDER_SUPABASE_ANON_KEY = "public-anon-key"

function resolveSupabaseBrowserConfig(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (supabaseUrl && supabaseAnonKey) {
    return { supabaseUrl, supabaseAnonKey }
  }

  if (typeof window === "undefined") {
    return {
      supabaseUrl: PLACEHOLDER_SUPABASE_URL,
      supabaseAnonKey: PLACEHOLDER_SUPABASE_ANON_KEY,
    }
  }

  throw new Error("Supabase環境変数が不足しています")
}

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

  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseBrowserConfig()

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  })
  return browserClient
}
