import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import HomePageClient from "@/HomePageClient"
import { getIsAdminFromProfile } from "@/lib/admin"

type HeroStats = {
  isAdmin: boolean
  skillsCount: number
  usersCount: number
}

async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

/** `next build` 中は静的解析・プリレンダの対象になり得るため cookies を触らず統計は取らない */
function isNextBuildPhase(): boolean {
  return (
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_PHASE === "phase-production-build"
  )
}

async function loadHeroStatsForAdmin(): Promise<HeroStats | null> {
  if (isNextBuildPhase()) {
    return null
  }
  try {
    const supabase = await getServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return null
    }

    const isAdmin = await getIsAdminFromProfile(supabase, user.id)
    if (!isAdmin) {
      return null
    }

    const supabaseAdmin = getSupabaseAdminClient()
    if (!supabaseAdmin) {
      return null
    }
    const [{ count: skillsCount }, { count: usersCount }] = await Promise.all([
      supabaseAdmin.from("skills").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ])

    return {
      isAdmin: true,
      skillsCount: Number(skillsCount ?? 0),
      usersCount: Number(usersCount ?? 0),
    }
  } catch (e) {
    if (isNextBuildPhase()) {
      return null
    }
    console.warn("[HomePage] 管理者向けヒーロー統計をスキップ（セッション未取得・DB等）", e)
    return null
  }
}

export default async function HomePage() {
  const heroStats = await loadHeroStatsForAdmin()
  return <HomePageClient heroStats={heroStats} />
}
