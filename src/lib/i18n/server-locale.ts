import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@/lib/i18n/locales"

/**
 * profiles.preferred_locale を読み取ってユーザーの優先言語を解決する。
 *
 * 設計方針（安全側に倒すこと）:
 * - 何らかの理由で取得に失敗した場合は必ず {@link DEFAULT_LOCALE}（'ja'）を返す。
 *   これにより、現状の日本人ユーザーは「これまで通り日本語」で確実にメールが届く。
 * - カラム未追加環境（マイグレーション未適用）でも throw しない。
 * - userId が空文字なら 'ja' を返す。
 */
export async function resolveUserPreferredLocale(
  supabaseAdmin: SupabaseClient,
  userId: string | null | undefined,
): Promise<Locale> {
  const trimmed = (userId ?? "").trim()
  if (!trimmed) {
    return DEFAULT_LOCALE
  }
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("preferred_locale")
      .eq("id", trimmed)
      .maybeSingle()
    const raw = (data as { preferred_locale?: string | null } | null)?.preferred_locale
    if (isSupportedLocale(raw)) {
      return raw
    }
    return DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}
