/**
 * ログインユーザー自身の `profiles.preferred_locale` を更新する API。
 *
 * 安全性の方針:
 * - 未ログイン時は 401 を返すだけ。Cookie 側の挙動には影響しない。
 * - 更新失敗時もクライアントには UI を妨げないよう 200/エラーいずれも sileint な扱いになるよう、
 *   呼び出し側（LocaleProvider）は best-effort で叩く想定。
 * - 自分以外の profile は更新できない（RLS / 認証ユーザー id 経由）。
 */
import { isSupportedLocale } from "@/lib/i18n/locales"
import { requireApiUser } from "@/lib/api-auth"

type RequestBody = {
  locale?: string
}

export async function POST(req: Request): Promise<Response> {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null
    const raw = (body?.locale ?? "").trim()
    if (!isSupportedLocale(raw)) {
      return Response.json({ error: "invalid_locale" }, { status: 400 })
    }

    const { supabase, user } = auth.context
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_locale: raw })
      .eq("id", user.id)

    if (error) {
      // カラム未追加環境 (マイグレーション未適用) や RLS 拒否などのケースをサイレントに扱う。
      console.warn("[api/user/preferred-locale] profiles.update failed", {
        message: error.message,
        code: (error as { code?: string }).code ?? null,
      })
      return Response.json({ ok: false, error: error.message }, { status: 200 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update preferred locale"
    console.warn("[api/user/preferred-locale] unexpected error", { message })
    return Response.json({ ok: false, error: message }, { status: 200 })
  }
}
