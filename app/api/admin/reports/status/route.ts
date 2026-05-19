import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"

const ALLOWED_STATUSES = new Set(["pending", "investigating", "resolved"])
const ALLOWED_TABLES = new Set(["user_reports", "product_reports"])

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

type UpdateReportStatusBody = {
  table?: string
  status?: string
  reporter_id?: string
  reported_user_id?: string
  product_id?: string | number
  created_at?: string
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json().catch(() => null)) as UpdateReportStatusBody | null
    const table = typeof body?.table === "string" ? body.table : ""
    const rawStatus = body?.status
    const reporterId = typeof body?.reporter_id === "string" ? body.reporter_id.trim() : ""
    const createdAt = typeof body?.created_at === "string" ? body.created_at.trim() : ""

    if (!ALLOWED_TABLES.has(table)) {
      return Response.json({ error: "Invalid table" }, { status: 400 })
    }
    if (typeof rawStatus !== "string" || !ALLOWED_STATUSES.has(rawStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 })
    }
    if (!reporterId || !createdAt) {
      return Response.json({ error: "reporter_id and created_at are required" }, { status: 400 })
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

    let query = supabaseAdmin.from(table).update({ status: rawStatus }).select("status")

    if (table === "user_reports") {
      const reportedUserId =
        typeof body?.reported_user_id === "string" ? body.reported_user_id.trim() : ""
      if (!reportedUserId) {
        return Response.json({ error: "reported_user_id is required" }, { status: 400 })
      }
      query = query
        .eq("reporter_id", reporterId)
        .eq("reported_user_id", reportedUserId)
        .eq("created_at", createdAt)
    } else {
      const productIdRaw = body?.product_id
      const productId =
        typeof productIdRaw === "number"
          ? String(productIdRaw)
          : typeof productIdRaw === "string"
            ? productIdRaw.trim()
            : ""
      if (!productId) {
        return Response.json({ error: "product_id is required" }, { status: 400 })
      }
      query = query.eq("reporter_id", reporterId).eq("product_id", productId).eq("created_at", createdAt)
    }

    const { data: updated, error: updateError } = await query.maybeSingle<{ status: string }>()

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: "Report not found" }, { status: 404 })
    }

    return Response.json({ ok: true, status: updated.status }, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update report status"
    return Response.json({ error: message }, { status: 500 })
  }
}
