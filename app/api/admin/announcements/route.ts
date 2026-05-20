import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function assertAdmin(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  const { data: adminRow, error: adminError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle<{ is_admin: boolean | null }>()

  return !adminError && adminRow?.is_admin === true
}

function isValidAnnouncementId(id: string | null): id is string {
  return typeof id === "string" && id.trim().length > 0
}

type PatchAnnouncementBody = {
  id?: string
  title?: string
  reason?: string
  content?: string
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
    if (!isValidAnnouncementId(id)) {
      return Response.json({ error: "Invalid announcement id" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    if (!(await assertAdmin(supabaseAdmin, auth.context.user.id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("is_admin_origin", true)
      .eq("type", "announcement")
      .select("id")

    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 })
    }
    if (!deleted?.length) {
      return Response.json({ error: "Announcement not found" }, { status: 404 })
    }

    return Response.json({ ok: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete announcement"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json().catch(() => null)) as PatchAnnouncementBody | null
    const id = typeof body?.id === "string" ? body.id.trim() : ""
    const title = typeof body?.title === "string" ? body.title.trim() : ""
    const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
    const content = typeof body?.content === "string" ? body.content.trim() : ""

    if (!isValidAnnouncementId(id)) {
      return Response.json({ error: "Invalid announcement id" }, { status: 400 })
    }
    if (!title || !reason || !content) {
      return Response.json({ error: "title, reason, and content are required" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    if (!(await assertAdmin(supabaseAdmin, auth.context.user.id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("notifications")
      .update({ title, reason, content })
      .eq("id", id)
      .eq("is_admin_origin", true)
      .eq("type", "announcement")
      .select("id, title, reason, content, created_at")
      .maybeSingle()

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: "Announcement not found" }, { status: 404 })
    }

    return Response.json({ ok: true, row: updated }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update announcement"
    return Response.json({ error: message }, { status: 500 })
  }
}
