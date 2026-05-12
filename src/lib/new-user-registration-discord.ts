import "server-only"

import { createClient, type User } from "@supabase/supabase-js"
import { sendDiscordNotification } from "@/lib/discord"
import { getSiteUrl } from "@/lib/site-seo"

const REGISTRATION_DISCORD_NOTIFIED_METADATA_KEY = "registration_discord_notified"

type NotifyNewUserRegistrationDiscordInput = {
  user: User
  email?: string | null
  displayName?: string | null
}

type NotifyNewUserRegistrationDiscordResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; skipped: string }

/** 運用では `DISCORD_WEBHOOK_USER_REGISTRATION`。旧名 `DISCORD_WEBHOOK_NEW_USER` は互換用 */
export function resolveNewUserDiscordWebhookUrl(): string {
  const candidates = [process.env.DISCORD_WEBHOOK_USER_REGISTRATION, process.env.DISCORD_WEBHOOK_NEW_USER]
  for (const raw of candidates) {
    const t = raw?.trim()
    if (t) {
      return t
    }
  }
  return ""
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function resolveDisplayName(user: User, explicitDisplayName?: string | null): string | null {
  const explicit = explicitDisplayName?.trim()
  if (explicit) {
    return explicit
  }

  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const fromDisplayName =
    typeof metadata?.display_name === "string" ? metadata.display_name.trim() : ""
  if (fromDisplayName) {
    return fromDisplayName
  }

  const fromFullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : ""
  if (fromFullName) {
    return fromFullName
  }

  return null
}

function hasRegistrationDiscordBeenNotified(user: User): boolean {
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  return metadata?.[REGISTRATION_DISCORD_NOTIFIED_METADATA_KEY] === true
}

async function markRegistrationDiscordNotified(user: User): Promise<void> {
  const admin = getSupabaseAdminClient()
  const metadata = user.user_metadata as Record<string, unknown> | undefined
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...metadata,
      [REGISTRATION_DISCORD_NOTIFIED_METADATA_KEY]: true,
    },
  })
  if (error) {
    throw error
  }
}

export async function notifyNewUserRegistrationDiscord(
  input: NotifyNewUserRegistrationDiscordInput,
): Promise<NotifyNewUserRegistrationDiscordResult> {
  const webhookUrl = resolveNewUserDiscordWebhookUrl()
  if (!webhookUrl) {
    return { ok: true, sent: false, skipped: "missing webhook" }
  }

  const admin = getSupabaseAdminClient()
  const { data: freshUserData, error: freshUserError } = await admin.auth.admin.getUserById(input.user.id)
  if (freshUserError) {
    throw freshUserError
  }

  const freshUser = freshUserData.user
  if (!freshUser) {
    return { ok: true, sent: false, skipped: "missing user" }
  }
  if (hasRegistrationDiscordBeenNotified(freshUser)) {
    return { ok: true, sent: false, skipped: "already notified" }
  }

  const userId = freshUser.id
  const email = (input.email ?? freshUser.email ?? "").trim()
  const displayName = resolveDisplayName(freshUser, input.displayName)
  const baseUrl = getSiteUrl().replace(/\/$/, "")
  const adminUsersUrl = `${baseUrl}/admin/users`

  await sendDiscordNotification(
    webhookUrl,
    [
      "🆕 **新規ユーザー登録**",
      `- ユーザーID: ${userId}`,
      displayName ? `- 表示名: ${displayName}` : null,
      email ? `- メール: ${email}` : null,
      `- 管理画面: ${adminUsersUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  )

  await markRegistrationDiscordNotified(freshUser)
  return { ok: true, sent: true }
}

export async function tryNotifyNewUserRegistrationDiscordFromSession(): Promise<void> {
  const { requireApiUser } = await import("@/lib/api-auth")
  const auth = await requireApiUser()
  if (!auth.ok) {
    return
  }

  try {
    await notifyNewUserRegistrationDiscord({ user: auth.context.user })
  } catch {
    // 通知失敗で画面遷移や登録フローを止めない
  }
}

export async function tryNotifyNewUserRegistrationDiscordForAuthUser(user: User): Promise<void> {
  try {
    await notifyNewUserRegistrationDiscord({ user })
  } catch {
    // 通知失敗で認証コールバックのリダイレクトを止めない
  }
}
