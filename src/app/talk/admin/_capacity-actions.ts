"use server"

import "server-only"

import { requireGritvibAdminUser } from "@/lib/talk/admin-auth"
import type { GritvibSubscriptionCapacityStatus } from "@/lib/talk/gritvib-subscription-capacity"
import {
  loadGritvibAdminSubscriptionCapacityStatus,
  saveGritvibSubscriptionCapacityMax,
} from "@/lib/talk/gritvib-subscription-capacity-store"
import { logTalkServerError } from "@/lib/talk/server-safe-log"

type CapacityStatusResult =
  | { ok: true; status: GritvibSubscriptionCapacityStatus }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "internal" }

type UpdateCapacityResult =
  | { ok: true; status: GritvibSubscriptionCapacityStatus }
  | {
      ok: false
      reason: "unauthenticated" | "forbidden" | "invalid_capacity" | "internal"
    }

export async function getGritvibAdminSubscriptionCapacityAction(): Promise<CapacityStatusResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }

  try {
    const status = await loadGritvibAdminSubscriptionCapacityStatus(adminCheck.session.supabase)
    return { ok: true, status }
  } catch (err) {
    logTalkServerError("[talk/admin/capacity] load failed", err)
    return { ok: false, reason: "internal" }
  }
}

export async function updateGritvibAdminSubscriptionCapacityAction(input: {
  capacityMax: string | number | null
}): Promise<UpdateCapacityResult> {
  const adminCheck = await requireGritvibAdminUser()
  if (!adminCheck.ok) {
    return {
      ok: false,
      reason: adminCheck.reason === "internal" ? "internal" : adminCheck.reason,
    }
  }

  let capacityMax: number
  if (input.capacityMax === null || input.capacityMax === "") {
    capacityMax = 0
  } else {
    const parsed =
      typeof input.capacityMax === "number"
        ? input.capacityMax
        : Number.parseInt(String(input.capacityMax).trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      return { ok: false, reason: "invalid_capacity" }
    }
    capacityMax = parsed
  }

  const saved = await saveGritvibSubscriptionCapacityMax(
    adminCheck.session.supabase,
    capacityMax,
  )
  if (!saved.ok) {
    return { ok: false, reason: "internal" }
  }

  try {
    const status = await loadGritvibAdminSubscriptionCapacityStatus(adminCheck.session.supabase)
    return { ok: true, status }
  } catch (err) {
    logTalkServerError("[talk/admin/capacity] reload after save failed", err)
    return { ok: false, reason: "internal" }
  }
}
