import type { PostgrestError } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { isTrustedAvatarPublicUrlForUser } from "@/lib/avatar-storage"

type Body = {
  bio?: unknown
  fitness_history?: unknown
  category?: unknown
  /** 省略時は avatar を変更しない。null で削除。文字列は同一プロジェクトの avatars バケット由来のみ */
  avatar_url?: unknown
}

function jsonFromPostgrestError(err: PostgrestError) {
  return {
    error: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  }
}

const GENERIC_SAVE_ERROR = "保存に失敗しました。"

function jsonErrorForClient(err: PostgrestError, isAdmin: boolean) {
  if (isAdmin) {
    return jsonFromPostgrestError(err)
  }
  return { error: GENERIC_SAVE_ERROR }
}

/**
 * 初回オンボーディング用。マイページと同じく「ログイン中ユーザーの JWT」で profiles を更新する。
 * サービスロールは RLS をバイパスできるが、キー誤設定時に匿名扱いになり失敗しやすいため本ルートでは使わない。
 */
export async function POST(req: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return auth.response
  }

  const { supabase, user } = auth.context
  const userId = user.id
  const body = (await req.json().catch(() => ({}))) as Body

  const projectUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

  const bio = typeof body.bio === "string" ? body.bio.trim() || null : null
  const fitness_history = typeof body.fitness_history === "string" ? body.fitness_history.trim() || null : null
  const category =
    Array.isArray(body.category) && body.category.every((c) => typeof c === "string") ? body.category : []

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("display_name, status, is_admin")
    .eq("id", userId)
    .maybeSingle()

  const isAdminUser = Boolean((existing as { is_admin?: boolean | null } | null)?.is_admin)

  if (existingError) {
    return Response.json(jsonErrorForClient(existingError, isAdminUser), { status: 400 })
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    typeof meta?.display_name === "string" && meta.display_name.trim().length > 0
      ? meta.display_name.trim()
      : typeof meta?.full_name === "string" && meta.full_name.trim().length > 0
        ? meta.full_name.trim()
        : null

  const existingRow = existing as { display_name?: string | null; status?: string | null } | null
  const existingName = (existingRow?.display_name ?? "").trim()
  const display_name = existingName.length > 0 ? existingName : fromMeta ?? "名前未設定"

  const basePayload: Record<string, unknown> = {
    id: userId,
    bio,
    fitness_history,
    category,
    display_name,
  }

  if (!existingRow) {
    basePayload.status = "active"
  }

  let result = await supabase.from("profiles").upsert(basePayload, { onConflict: "id" })

  if (result.error && "category" in basePayload) {
    const { category: _drop, ...withoutCategory } = basePayload
    void _drop
    result = await supabase.from("profiles").upsert(withoutCategory, { onConflict: "id" })
  }

  if (result.error) {
    return Response.json(jsonErrorForClient(result.error, isAdminUser), { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
    const raw = body.avatar_url
    if (raw === null) {
      const up = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId)
      if (up.error) {
        return Response.json(jsonErrorForClient(up.error, isAdminUser), { status: 400 })
      }
    } else if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (trimmed.length === 0) {
        const up = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId)
        if (up.error) {
          return Response.json(jsonErrorForClient(up.error, isAdminUser), { status: 400 })
        }
      } else if (!projectUrl || !isTrustedAvatarPublicUrlForUser(trimmed, userId, projectUrl)) {
        return Response.json(
          { error: isAdminUser ? "アバター画像の URL が無効です。" : GENERIC_SAVE_ERROR },
          { status: 400 },
        )
      } else {
        const up = await supabase.from("profiles").update({ avatar_url: trimmed }).eq("id", userId)
        if (up.error) {
          return Response.json(jsonErrorForClient(up.error, isAdminUser), { status: 400 })
        }
      }
    } else {
      return Response.json(
        { error: isAdminUser ? "avatar_url の形式が不正です。" : GENERIC_SAVE_ERROR },
        { status: 400 },
      )
    }
  }

  return Response.json({ ok: true })
}
