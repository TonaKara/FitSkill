import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const SKILL_OG_CACHE_HEADER =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"

/** public が無い環境でも 200 で画像を返すための 1x1 透明 PNG */
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

async function defaultSkillImageResponse(): Promise<NextResponse> {
  try {
    const filePath = path.join(process.cwd(), "public", "images", "default-skill.png")
    const buf = await readFile(filePath)
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": SKILL_OG_CACHE_HEADER,
      },
    })
  } catch {
    return new NextResponse(FALLBACK_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": SKILL_OG_CACHE_HEADER,
      },
    })
  }
}

/**
 * SNS クローラ向けに同一オリジンでサムネイルを返す。
 * og:image に Supabase Storage の直リンクを載せると取得失敗することがあるため、サーバーがストレージから取得して転送する。
 */
export async function getSkillOgImageResponse(rawId: string): Promise<NextResponse> {
  const id = rawId.trim()
  if (!id) {
    return defaultSkillImageResponse()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const dbKey = serviceKey ?? anonKey

  if (!supabaseUrl || !dbKey) {
    return defaultSkillImageResponse()
  }

  const supabase = createClient(supabaseUrl, dbKey)
  const { data, error } = await supabase
    .from("skills")
    .select("thumbnail_url, is_published")
    .eq("id", id)
    .maybeSingle()

  if (error || !data || data.is_published === false) {
    return defaultSkillImageResponse()
  }

  const thumb =
    typeof data.thumbnail_url === "string" && data.thumbnail_url.trim().length > 0
      ? data.thumbnail_url.trim()
      : ""

  if (!/^https?:\/\//i.test(thumb)) {
    return defaultSkillImageResponse()
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const upstream = await fetch(thumb, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "image/*" },
    })

    if (!upstream.ok || !upstream.body) {
      return defaultSkillImageResponse()
    }

    const ctRaw = upstream.headers.get("content-type") ?? ""
    const ct = ctRaw.toLowerCase()
    if (!ct.startsWith("image/") || ct.includes("svg")) {
      return defaultSkillImageResponse()
    }

    const contentType = ctRaw.split(";")[0]?.trim() ?? "image/jpeg"

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": SKILL_OG_CACHE_HEADER,
      },
    })
  } catch {
    return defaultSkillImageResponse()
  } finally {
    clearTimeout(timeout)
  }
}
