import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildGritvibSubscriptionCapacityStatus,
  isGritvibChatSubscriptionActive,
  type GritvibSubscriptionCapacityStatus,
} from "@/lib/talk/gritvib-subscription-capacity"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

/** ユーザー向け UI には出さない（詳細はサーバーログのみ）。 */
export class GritvibSubscriptionCapacityLoadError extends Error {
  constructor() {
    super("gritvib_subscription_capacity_load_failed")
    this.name = "GritvibSubscriptionCapacityLoadError"
  }
}

async function readCapacityMax(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("gritvib_settings")
    .select("subscription_capacity_max")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    logTalkServerError("[talk/capacity] settings read failed", error)
    throw new GritvibSubscriptionCapacityLoadError()
  }

  const raw = data?.subscription_capacity_max
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0
}

async function countActiveSubscriptions(
  supabase: SupabaseClient,
  useAdminMemberList: boolean,
): Promise<number> {
  if (useAdminMemberList) {
    const { data: members, error } = await supabase
      .from("gritvib_chat_members")
      .select("subscription_status, subscription_current_period_end")

    if (error) {
      logTalkServerError("[talk/capacity] members read failed", error)
      throw new GritvibSubscriptionCapacityLoadError()
    }
    return (members ?? []).filter((row) =>
      isGritvibChatSubscriptionActive(
        row.subscription_status,
        row.subscription_current_period_end,
      ),
    ).length
  }

  const { data, error } = await supabase.rpc("gritvib_count_active_subscriptions")
  if (error) {
    logTalkServerError("[talk/capacity] count rpc failed", error)
    throw new GritvibSubscriptionCapacityLoadError()
  }
  const n = Number(data)
  return Number.isFinite(n) ? n : 0
}

/** 管理画面: settings + 会員一覧から有効人数を集計。 */
export async function loadGritvibAdminSubscriptionCapacityStatus(
  supabase: SupabaseClient,
): Promise<GritvibSubscriptionCapacityStatus> {
  const [capacityMax, activeCount] = await Promise.all([
    readCapacityMax(supabase),
    countActiveSubscriptions(supabase, true),
  ])
  return buildGritvibSubscriptionCapacityStatus({ activeCount, capacityMax })
}

/** 会員チャット: settings + カウント RPC。 */
export async function loadGritvibMemberSubscriptionCapacityStatus(
  supabase: SupabaseClient,
): Promise<GritvibSubscriptionCapacityStatus> {
  const [capacityMax, activeCount] = await Promise.all([
    readCapacityMax(supabase),
    countActiveSubscriptions(supabase, false),
  ])
  return buildGritvibSubscriptionCapacityStatus({ activeCount, capacityMax })
}

/** 管理画面: 上限人数を保存（管理者 RLS）。 */
export async function saveGritvibSubscriptionCapacityMax(
  supabase: SupabaseClient,
  capacityMax: number,
): Promise<{ ok: true } | { ok: false }> {
  const { data, error } = await supabase
    .from("gritvib_settings")
    .upsert(
      {
        id: 1,
        subscription_capacity_max: capacityMax,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("subscription_capacity_max")
    .maybeSingle()

  if (error) {
    logTalkServerError("[talk/capacity] settings upsert failed", error)
    return { ok: false }
  }

  if (!data || data.subscription_capacity_max !== capacityMax) {
    logTalkServerError("[talk/capacity] settings upsert verify failed")
    return { ok: false }
  }

  return { ok: true }
}
