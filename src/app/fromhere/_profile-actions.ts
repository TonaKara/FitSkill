"use server"

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { requireActionUser } from "@/lib/supabase/action-auth"
import { tryNotifyNewUserRegistrationDiscordForAuthUser } from "@/lib/new-user-registration-discord"
import { isTrustedAvatarPublicUrlForUser } from "@/lib/avatar-storage"

import {
  FROMHERE_BIO_MAX_LENGTH,
  FROMHERE_HANDLE_REGEX,
  normalizeFromHereHandle,
} from "@/fromhere/_handle-validation"
import {
  validateFromHereProfileEdit,
  type FromHereProfileEditErrorKey,
} from "@/fromhere/_profile-validation"
import {
  FROMHERE_AVATARS_BUCKET,
  validateFromHereAvatarPath,
} from "@/fromhere/_avatar-validation"

/** ----------------------------------------------------------
 *  FromHere プロフィール Server Actions
 *
 *  Route Handler の代替として実装。理由は他の `_*-actions.ts` と同じ
 *  （ファイルシステムルーターの不具合回避）。
 *
 *  クライアント:
 *    - `onboarding/page.tsx`                 (createFromHereProfileAction, checkFromHereHandleAvailabilityAction)
 *    - `profile/edit/EditProfilePageClient.tsx`  (updateFromHereProfileAction)
 *    - `settings/SettingsPageClient.tsx`       (updateFromHereProfileAction)
 * ---------------------------------------------------------- */

export type FromHereProfileActionError =
  | "format"
  | "displayName"
  | "bio"
  | "reserved"
  | "taken"
  | "conflict"
  | "internal"
  | "rate_limited"
  | "not_found"
  | "avatarPath"
  | "avatarOwner"
  | "avatarMissing"
  | "avatarUrl"
  | "handleInvalid"
  | "handleAlreadyChanged"
  | "handleLocked"
  | "unauthorized"
  | FromHereProfileEditErrorKey

export type FromHereProfileSnapshot = {
  id: string
  handle: string
  display_name: string
  bio: string | null
  avatar_path: string | null
  avatar_url: string | null
}

export type FromHereProfileActionResult =
  | { ok: true; profile: FromHereProfileSnapshot }
  | { ok: false; error: FromHereProfileActionError }

export type FromHereHandleAvailability = {
  available: boolean
  reason?: "format" | "reserved" | "taken" | "error"
  normalized: string
}

/** ----------------------------------------------------------
 *  PATCH 用レートリミット
 *  - 60s / 5 回、3600s / 30 回
 * ---------------------------------------------------------- */
type Limit = { windowMs: number; max: number }
type RateBucket = Map<string, { count: number; resetAt: number }>

const PATCH_LIMITS: Limit[] = [
  { windowMs: 60_000, max: 5 },
  { windowMs: 60 * 60_000, max: 30 },
]
const patchBuckets: RateBucket[] = PATCH_LIMITS.map(() => new Map())

function consumeRate(buckets: RateBucket[], limits: Limit[], userId: string): boolean {
  const now = Date.now()
  for (let i = 0; i < limits.length; i++) {
    const entry = buckets[i]!.get(userId)
    if (entry && entry.resetAt > now && entry.count >= limits[i]!.max) {
      return false
    }
  }
  for (let i = 0; i < limits.length; i++) {
    const { windowMs } = limits[i]!
    const store = buckets[i]!
    const entry = store.get(userId)
    if (!entry || entry.resetAt <= now) {
      store.set(userId, { count: 1, resetAt: now + windowMs })
    } else {
      entry.count += 1
    }
  }
  return true
}

async function existsStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<boolean> {
  const lastSlash = path.lastIndexOf("/")
  if (lastSlash <= 0) {
    return false
  }
  const folder = path.slice(0, lastSlash)
  const filename = path.slice(lastSlash + 1)
  if (!folder || !filename) {
    return false
  }
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    search: filename,
    limit: 1,
  })
  if (error || !data) {
    return false
  }
  return data.some((item) => item.name === filename)
}

/** ----------------------------------------------------------
 *  プロフィール新規作成 (onboarding)
 * ---------------------------------------------------------- */
export async function createFromHereProfileAction(input: {
  handle: unknown
  displayName: unknown
  bio?: unknown
  avatarUrl?: unknown
}): Promise<FromHereProfileActionResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const supabase = auth.session.supabase
    const userId = auth.session.user.id

    const handle = normalizeFromHereHandle(String(input.handle ?? ""))
    const displayName = String(input.displayName ?? "").trim()
    const bioRaw = String(input.bio ?? "").trim()
    const bio = bioRaw.length === 0 ? null : bioRaw

    if (!FROMHERE_HANDLE_REGEX.test(handle)) {
      return { ok: false, error: "format" }
    }
    if (displayName.length < 1 || displayName.length > 50) {
      return { ok: false, error: "displayName" }
    }
    if (bio !== null && bio.length > FROMHERE_BIO_MAX_LENGTH) {
      return { ok: false, error: "bio" }
    }

    let initialAvatarUrl: string | null = null
    if (typeof input.avatarUrl === "string" && input.avatarUrl.trim().length > 0) {
      const candidate = input.avatarUrl.trim()
      if (candidate.length > 500) {
        return { ok: false, error: "avatarUrl" }
      }
      const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
      if (!isTrustedAvatarPublicUrlForUser(candidate, userId, supabaseProjectUrl)) {
        return { ok: false, error: "avatarUrl" }
      }
      initialAvatarUrl = candidate
    }

    const { data: existingOwn, error: existingOwnError } = await supabase
      .from("newvibes_profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle()
    if (existingOwnError) {
      console.error("[fromhere/profile create] own lookup failed", existingOwnError)
      return { ok: false, error: "internal" }
    }
    if (existingOwn) {
      return { ok: false, error: "conflict" }
    }

    const { data: reserved, error: reservedError } = await supabase
      .from("newvibes_reserved_handles")
      .select("handle")
      .eq("handle", handle)
      .maybeSingle()
    if (reservedError) {
      console.error("[fromhere/profile create] reserved lookup failed", reservedError)
      return { ok: false, error: "internal" }
    }
    if (reserved) {
      return { ok: false, error: "reserved" }
    }

    const { data: taken, error: takenError } = await supabase
      .from("newvibes_profiles")
      .select("id")
      .eq("handle", handle)
      .maybeSingle()
    if (takenError) {
      console.error("[fromhere/profile create] taken lookup failed", takenError)
      return { ok: false, error: "internal" }
    }
    if (taken) {
      return { ok: false, error: "taken" }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("newvibes_profiles")
      .insert({
        id: userId,
        handle,
        display_name: displayName,
        bio,
        avatar_url: initialAvatarUrl,
      })
      .select("id, handle, display_name, bio, avatar_path, avatar_url")
      .single()
    if (insertError || !inserted) {
      const message = insertError?.message ?? ""
      if (message.includes("newvibes_profiles_handle_key")) {
        return { ok: false, error: "taken" }
      }
      if (message.toLowerCase().includes("reserved")) {
        return { ok: false, error: "reserved" }
      }
      console.error("[fromhere/profile create] insert failed", insertError)
      return { ok: false, error: "internal" }
    }

    // 新規ユーザー Discord 通知 (失敗しても作成は成功扱い)
    await tryNotifyNewUserRegistrationDiscordForAuthUser(auth.session.user)

    return {
      ok: true,
      profile: {
        id: inserted.id as string,
        handle: inserted.handle as string,
        display_name: inserted.display_name as string,
        bio: (inserted.bio as string | null) ?? null,
        avatar_path: (inserted.avatar_path as string | null) ?? null,
        avatar_url: (inserted.avatar_url as string | null) ?? null,
      },
    }
  } catch (error) {
    console.error("[fromhere/profile create] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  プロフィール更新 (display_name / bio / avatar)
 *  - handle は一度設定したら不変 (DB トリガでも保証)
 * ---------------------------------------------------------- */
export async function updateFromHereProfileAction(input: {
  handle?: unknown
  displayName?: unknown
  bio?: unknown
  avatarPath?: unknown
  avatarUrl?: unknown
}): Promise<FromHereProfileActionResult> {
  try {
    const auth = await requireActionUser()
    if (!auth.ok) {
      return { ok: false, error: "unauthorized" }
    }
    const supabase = auth.session.supabase
    const userId = auth.session.user.id

    if (!consumeRate(patchBuckets, PATCH_LIMITS, userId)) {
      return { ok: false, error: "rate_limited" }
    }

    const validation = validateFromHereProfileEdit({
      displayName: input.displayName,
      bio: input.bio,
    })
    if (!validation.ok) {
      return { ok: false, error: validation.error }
    }
    const { displayName, bio } = validation.value

    const { data: existing, error: existingError } = await supabase
      .from("newvibes_profiles")
      .select("id, handle, avatar_path, handle_change_count")
      .eq("id", userId)
      .maybeSingle()
    if (existingError) {
      console.error("[fromhere/profile update] lookup failed", existingError)
      return { ok: false, error: "internal" }
    }
    if (!existing) {
      return { ok: false, error: "not_found" }
    }

    // handle は不変。送信されたら現在値と一致するときのみ受け付け、異なれば locked
    if (typeof input.handle === "string") {
      const normalized = normalizeFromHereHandle(input.handle)
      if (normalized !== (existing.handle as string)) {
        return { ok: false, error: "handleLocked" }
      }
    }

    const previousPath = (existing.avatar_path as string | null) ?? null
    let nextAvatarPath: string | null | undefined
    if (input.avatarPath === undefined) {
      nextAvatarPath = undefined
    } else if (input.avatarPath === null || input.avatarPath === "") {
      nextAvatarPath = null
    } else if (typeof input.avatarPath === "string") {
      const av = validateFromHereAvatarPath(input.avatarPath)
      if (!av.ok) {
        return { ok: false, error: "avatarPath" }
      }
      const folder = av.path.split("/")[0] ?? ""
      if (folder !== userId) {
        return { ok: false, error: "avatarOwner" }
      }
      const exists = await existsStorageObject(supabase, FROMHERE_AVATARS_BUCKET, av.path)
      if (!exists) {
        return { ok: false, error: "avatarMissing" }
      }
      nextAvatarPath = av.path
    } else {
      return { ok: false, error: "avatarPath" }
    }

    const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    let nextAvatarUrl: string | null | undefined
    if (input.avatarUrl === undefined) {
      nextAvatarUrl = undefined
    } else if (input.avatarUrl === null || input.avatarUrl === "") {
      nextAvatarUrl = null
    } else if (typeof input.avatarUrl === "string") {
      const candidate = input.avatarUrl.trim()
      if (candidate.length === 0 || candidate.length > 500) {
        return { ok: false, error: "avatarUrl" }
      }
      if (!isTrustedAvatarPublicUrlForUser(candidate, userId, supabaseProjectUrl)) {
        return { ok: false, error: "avatarUrl" }
      }
      nextAvatarUrl = candidate
    } else {
      return { ok: false, error: "avatarUrl" }
    }

    const updatePayload: Record<string, unknown> = {
      display_name: displayName,
      bio,
    }
    if (nextAvatarPath !== undefined) {
      updatePayload.avatar_path = nextAvatarPath
    }
    if (nextAvatarUrl !== undefined) {
      updatePayload.avatar_url = nextAvatarUrl
    }

    const { data: updated, error: updateError } = await supabase
      .from("newvibes_profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, handle, display_name, bio, avatar_path, avatar_url")
      .single()
    if (updateError || !updated) {
      const code = (updateError as { code?: string } | null)?.code ?? ""
      const message = updateError?.message ?? ""
      if (code === "23514" && message.toLowerCase().includes("handle")) {
        return { ok: false, error: "handleLocked" }
      }
      if (code === "23505" && message.toLowerCase().includes("handle")) {
        return { ok: false, error: "taken" }
      }
      console.error("[fromhere/profile update] update failed", updateError)
      return { ok: false, error: "internal" }
    }

    // 古い avatar オブジェクトの掃除 (best-effort)
    if (
      nextAvatarPath !== undefined &&
      previousPath &&
      previousPath !== nextAvatarPath
    ) {
      try {
        await supabase.storage.from(FROMHERE_AVATARS_BUCKET).remove([previousPath])
      } catch {
        /* noop */
      }
    }

    return {
      ok: true,
      profile: {
        id: updated.id as string,
        handle: updated.handle as string,
        display_name: updated.display_name as string,
        bio: (updated.bio as string | null) ?? null,
        avatar_path: (updated.avatar_path as string | null) ?? null,
        avatar_url: (updated.avatar_url as string | null) ?? null,
      },
    }
  } catch (error) {
    console.error("[fromhere/profile update] unexpected", error)
    return { ok: false, error: "internal" }
  }
}

/** ----------------------------------------------------------
 *  ハンドル可用性チェック (onboarding 用)
 *  - 認証不要 (公開エンドポイント相当)。Server Action は本来認証ありが想定
 *    だが、`requireActionUser` をスキップして任意の閲覧者から呼べるようにする。
 * ---------------------------------------------------------- */
export async function checkFromHereHandleAvailabilityAction(input: {
  handle: unknown
}): Promise<FromHereHandleAvailability> {
  const raw = typeof input.handle === "string" ? input.handle : ""
  const handle = normalizeFromHereHandle(raw)

  if (!handle) {
    return { available: false, reason: "format", normalized: "" }
  }
  if (!FROMHERE_HANDLE_REGEX.test(handle)) {
    return { available: false, reason: "format", normalized: handle }
  }

  try {
    // cookie session を経由した RLS で参照する (誰でも SELECT 可能なテーブルなので OK)
    const auth = await requireActionUser()
    // 未ログインでも cookieSupabase は返ってくる構成だが、現状の `requireActionUser` は
    // 未ログインで `error` を返す。可用性チェックは未ログイン onboarding 直前にも呼ばれる
    // ため、別の最小 supabase クライアントを使う必要がある。
    if (!auth.ok) {
      // 未ログイン経路: server-only モジュールを動的に読み込んで匿名クライアントを生成
      const { createServerClient } = await import("@supabase/ssr")
      const { cookies } = await import("next/headers")
      const cookieStore = await cookies()
      const anon = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll() {
              /* noop */
            },
          },
        },
      )
      return await lookupHandleAvailability(anon, handle)
    }

    return await lookupHandleAvailability(auth.session.supabase, handle)
  } catch (error) {
    console.error("[fromhere/handle availability] unexpected", error)
    return { available: false, reason: "error", normalized: handle }
  }
}

async function lookupHandleAvailability(
  supabase: SupabaseClient,
  handle: string,
): Promise<FromHereHandleAvailability> {
  const [{ data: reserved, error: reservedError }, { data: existing, error: profileError }] =
    await Promise.all([
      supabase
        .from("newvibes_reserved_handles")
        .select("handle")
        .eq("handle", handle)
        .maybeSingle(),
      supabase
        .from("newvibes_profiles")
        .select("id")
        .eq("handle", handle)
        .maybeSingle(),
    ])

  if (reservedError || profileError) {
    return { available: false, reason: "error", normalized: handle }
  }
  if (reserved) {
    return { available: false, reason: "reserved", normalized: handle }
  }
  if (existing) {
    return { available: false, reason: "taken", normalized: handle }
  }
  return { available: true, normalized: handle }
}
