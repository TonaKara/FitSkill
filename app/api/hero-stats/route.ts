import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { getIsAdminFromProfile } from "@/lib/admin"

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

async function getAuthedSupabase() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, user }
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthedSupabase()
    if (!user) {
      return Response.json({ isAdmin: false }, { status: 200 })
    }

    const isAdmin = await getIsAdminFromProfile(supabase, user.id)
    if (!isAdmin) {
      return Response.json({ isAdmin: false }, { status: 200 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
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
