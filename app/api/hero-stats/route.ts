import { createClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function GET() {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return Response.json({ isAdmin: false }, { status: 200 })
    }
    const { user } = auth.context

    const supabaseAdmin = getSupabaseAdminClient()
    const { data: adminRow, error: adminError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<{ is_admin: boolean | null }>()

    if (adminError || adminRow?.is_admin !== true) {
      return Response.json({ isAdmin: false }, { status: 200 })
    }

    const [{ count: skillsCount, error: skillsError }, { count: usersCount, error: usersError }] = await Promise.all([
      supabaseAdmin.from("skills").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ])

    if (skillsError || usersError) {
      const message = skillsError?.message ?? usersError?.message ?? "Failed to load hero stats"
      return Response.json({ error: message }, { status: 500 })
    }

    return Response.json(
      {
        isAdmin: true,
        skillsCount: Number(skillsCount ?? 0),
        activeUsersCount: Number(usersCount ?? 0),
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load hero stats"
    return Response.json({ error: message }, { status: 500 })
  }
}
