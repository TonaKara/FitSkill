import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"

const ALLOWED_STATUSES = new Set(["pending", "investigating", "resolved"])

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

type UpdateContactStatusBody = {
  id?: number | string
  status?: string
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json().catch(() => null)) as UpdateContactStatusBody | null
    const rawId = body?.id
    const rawStatus = body?.status

    const id =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string" && /^\d+$/.test(rawId)
          ? Number(rawId)
          : Number.NaN
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Invalid contact id" }, { status: 400 })
    }
    if (typeof rawStatus !== "string" || !ALLOWED_STATUSES.has(rawStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    const { user } = auth.context
    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null }>()

    if (adminError || adminRow?.is_admin !== true) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("contact_submissions")
      .update({ status: rawStatus })
      .eq("id", id)
      .select("id")
      .maybeSingle<{ id: number }>()

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: "Contact submission not found" }, { status: 404 })
    }

    return Response.json({ ok: true }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update contact status"
    return Response.json({ error: message }, { status: 500 })
  }
}
