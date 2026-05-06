import { createClient } from "@supabase/supabase-js"
import type { PostgrestError } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { isTrustedAvatarPublicUrlForUser } from "@/lib/avatar-storage"

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  return createClient(url, key)
}

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

export async function POST(req: Request) {
  const auth = await requireApiUser()
  if (!auth.ok) {
    return auth.response
  }

  const admin = getSupabaseAdminClient()
  if (!admin) {
    return Response.json({ error: "サーバー設定が不完全です（SERVICE_ROLE）。" }, { status: 500 })
  }

  const projectUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const userId = auth.context.user.id
  const body = (await req.json().catch(() => ({}))) as Body

  const bio = typeof body.bio === "string" ? body.bio.trim() || null : null
  const fitness_history = typeof body.fitness_history === "string" ? body.fitness_history.trim() || null : null
  const category =
    Array.isArray(body.category) && body.category.every((c) => typeof c === "string") ? body.category : []

  const { data: existing } = await admin.from("profiles").select("display_name, status").eq("id", userId).maybeSingle()

  const meta = auth.context.user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    typeof meta?.display_name === "string" && meta.display_name.trim().length > 0
      ? meta.display_name.trim()
      : typeof meta?.full_name === "string" && meta.full_name.trim().length > 0
        ? meta.full_name.trim()
        : null

  const existingRow = existing as { display_name?: string | null; status?: string | null } | null
  const existingName = (existingRow?.display_name ?? "").trim()
  const display_name = existingName.length > 0 ? existingName : fromMeta ?? "名前未設定"

  const minimalPayload: Record<string, unknown> = {
    id: userId,
    display_name,
  }

  if (!existingRow) {
    minimalPayload.status = "active"
  }

  let result = await admin.from("profiles").upsert(minimalPayload, { onConflict: "id" })

  if (result.error) {
    return Response.json(jsonFromPostgrestError(result.error), { status: 400 })
  }

  const { error: rpcError } = await admin.rpc("set_profile_intro_fields", {
    target_user_id: userId,
    new_bio: bio,
    new_fitness_history: fitness_history,
    new_category: category,
  })

  if (rpcError) {
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

    result = await admin.from("profiles").upsert(basePayload, { onConflict: "id" })

    if (result.error && "category" in basePayload) {
      const { category: _drop, ...withoutCategory } = basePayload
      void _drop
      result = await admin.from("profiles").upsert(withoutCategory, { onConflict: "id" })
    }

    if (result.error) {
      return Response.json(jsonFromPostgrestError(result.error), { status: 400 })
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "avatar_url")) {
    const raw = body.avatar_url
    if (raw === null) {
      const up = await admin.from("profiles").update({ avatar_url: null }).eq("id", userId)
      if (up.error) {
        return Response.json(jsonFromPostgrestError(up.error), { status: 400 })
      }
    } else if (typeof raw === "string") {
      const trimmed = raw.trim()
      if (trimmed.length === 0) {
        const up = await admin.from("profiles").update({ avatar_url: null }).eq("id", userId)
        if (up.error) {
          return Response.json(jsonFromPostgrestError(up.error), { status: 400 })
        }
      } else if (!projectUrl || !isTrustedAvatarPublicUrlForUser(trimmed, userId, projectUrl)) {
        return Response.json({ error: "アバター画像の URL が無効です。" }, { status: 400 })
      } else {
        const up = await admin.from("profiles").update({ avatar_url: trimmed }).eq("id", userId)
        if (up.error) {
          return Response.json(jsonFromPostgrestError(up.error), { status: 400 })
        }
      }
    } else {
      return Response.json({ error: "avatar_url の形式が不正です。" }, { status: 400 })
    }
  }

  return Response.json({ ok: true })
}
