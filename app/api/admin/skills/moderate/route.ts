import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireApiUser } from "@/lib/api-auth"
import { sendUserEventEmail } from "@/lib/event-email"
import { getAppBaseUrl } from "@/lib/site-seo"

type ModerateSkillBody = {
  skillId?: string | number
  action?: "set_published" | "delete"
  isPublished?: boolean
  reason?: string
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are missing")
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

function normalizeSkillId(raw: string | number | undefined): string | number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw
  }
  const text = String(raw ?? "").trim()
  if (!text) {
    return null
  }
  if (/^\d+$/.test(text)) {
    return Number(text)
  }
  return text
}

function isSkillDeleteBlockedError(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false
  }
  if (error.code === "23503") {
    return true
  }
  const message = error.message?.toLowerCase() ?? ""
  return message.includes("foreign key") && message.includes("skills")
}

async function releaseActiveCheckoutReservations(
  supabaseAdmin: SupabaseClient,
  skillId: string | number,
) {
  const { error } = await supabaseAdmin
    .from("skill_checkout_reservations")
    .update({ released_at: new Date().toISOString() })
    .eq("skill_id", skillId)
    .is("consumed_at", null)
    .is("released_at", null)

  if (error) {
    console.error("[admin/skills/moderate] release checkout reservations failed", {
      message: error.message,
      code: (error as { code?: string }).code ?? null,
      skillId: String(skillId),
    })
  }
}

async function archiveSkillForModeration(params: {
  supabaseAdmin: SupabaseClient
  adminUserId: string
  skillId: string | number
  ownerId: string | null
  skillTitle: string
  reason: string
}) {
  await releaseActiveCheckoutReservations(params.supabaseAdmin, params.skillId)

  const { data: updatedRows, error: updateError } = await params.supabaseAdmin
    .from("skills")
    .update({ is_published: false, admin_publish_locked: true })
    .eq("id", params.skillId)
    .select("id")

  if (updateError) {
    return { ok: false as const, error: updateError.message }
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false as const, error: "Skill archive returned no rows" }
  }

  await notifySkillOwnerModeration({
    supabaseAdmin: params.supabaseAdmin,
    adminUserId: params.adminUserId,
    recipientId: params.ownerId,
    notificationType: "admin_product_deleted",
    content: `運営対応: 商品「${params.skillTitle}」を削除しました。理由: ${params.reason}`,
    emailAction: "deleted",
    skillTitle: params.skillTitle,
    reason: params.reason,
  })

  return { ok: true as const }
}

type ModerationEmailAction = "unpublished" | "published" | "deleted"

async function notifySkillOwnerModeration(params: {
  supabaseAdmin: SupabaseClient
  adminUserId: string
  recipientId: string | null
  notificationType: string
  content: string
  emailAction: ModerationEmailAction
  skillTitle: string
  reason: string
}) {
  const recipientId = params.recipientId?.trim() || null
  if (!recipientId || recipientId === params.adminUserId) {
    return
  }

  const { error } = await params.supabaseAdmin.from("notifications").insert({
    recipient_id: recipientId,
    sender_id: params.adminUserId,
    type: params.notificationType,
    title: null,
    reason: null,
    content: params.content,
    is_admin_origin: true,
    is_read: false,
  })
  if (error) {
    console.error("[admin/skills/moderate] notifications insert failed", {
      message: error.message,
      code: (error as { code?: string }).code ?? null,
      details: (error as { details?: string }).details ?? null,
      hint: (error as { hint?: string }).hint ?? null,
      recipientId,
      type: params.notificationType,
    })
  }

  const appUrl = getAppBaseUrl()
  const displayTitle = params.skillTitle.trim() || "商品"
  const subject =
    params.emailAction === "deleted"
      ? "【GritVib】商品が削除されました"
      : params.emailAction === "published"
        ? "【GritVib】商品が公開されました"
        : "【GritVib】商品が非公開されました"
  const actionPhrase =
    params.emailAction === "deleted"
      ? "削除"
      : params.emailAction === "published"
        ? "公開"
        : "非公開"

  try {
    await sendUserEventEmail({
      topic: "account_notice",
      userId: recipientId,
      subject,
      heading: "商品モデレーション通知",
      intro: `運営対応により商品「${displayTitle}」が${actionPhrase}されました。`,
      lines: params.reason ? [`理由: ${params.reason}`] : [],
      ctaLabel: "マイページを開く",
      ctaUrl: `${appUrl}/mypage?section=listings`,
    })
  } catch (emailError) {
    console.error("[admin/skills/moderate] sendUserEventEmail failed", emailError)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser()
    if (!auth.ok) {
      return auth.response
    }

    const body = (await request.json().catch(() => null)) as ModerateSkillBody | null
    const skillId = normalizeSkillId(body?.skillId)
    const action = body?.action
    const reason = String(body?.reason ?? "").trim()

    if (!skillId) {
      return Response.json({ error: "skillId is required" }, { status: 400 })
    }
    if (action !== "set_published" && action !== "delete") {
      return Response.json({ error: "Invalid action" }, { status: 400 })
    }
    if (!reason) {
      return Response.json({ error: "reason is required" }, { status: 400 })
    }
    if (action === "set_published" && typeof body?.isPublished !== "boolean") {
      return Response.json({ error: "isPublished is required" }, { status: 400 })
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

    const { data: skillRow, error: skillLoadError } = await supabaseAdmin
      .from("skills")
      .select("id, user_id, title, is_published")
      .eq("id", skillId)
      .maybeSingle<{ id: string | number; user_id: string | null; title: string | null; is_published: boolean | null }>()

    if (skillLoadError) {
      return Response.json({ error: skillLoadError.message }, { status: 500 })
    }
    if (!skillRow?.id) {
      return Response.json({ error: "Skill not found" }, { status: 404 })
    }

    const skillTitle = skillRow.title?.trim() || String(skillRow.id)
    const ownerId = skillRow.user_id?.trim() || null

    if (action === "set_published") {
      const nextPublished = body?.isPublished === true
      const { data: updatedRows, error: updateError } = await supabaseAdmin
        .from("skills")
        .update({
          is_published: nextPublished,
          admin_publish_locked: nextPublished ? false : true,
        })
        .eq("id", skillRow.id)
        .select("id, is_published, admin_publish_locked")

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
      }
      if (!updatedRows || updatedRows.length === 0) {
        return Response.json({ error: "Skill update returned no rows" }, { status: 404 })
      }

      await notifySkillOwnerModeration({
        supabaseAdmin,
        adminUserId: user.id,
        recipientId: ownerId,
        notificationType: "admin_product_visibility",
        content: `運営対応: あなたの商品「${skillTitle}」を${nextPublished ? "公開" : "非公開"}に変更しました。理由: ${reason}`,
        emailAction: nextPublished ? "published" : "unpublished",
        skillTitle,
        reason,
      })

      return Response.json({
        ok: true,
        action,
        skillId: String(skillRow.id),
        isPublished: nextPublished,
      })
    }

    const { count: transactionCount, error: transactionCountError } = await supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("skill_id", skillRow.id)

    if (transactionCountError) {
      return Response.json({ error: transactionCountError.message }, { status: 500 })
    }

    if ((transactionCount ?? 0) > 0) {
      const archived = await archiveSkillForModeration({
        supabaseAdmin,
        adminUserId: user.id,
        skillId: skillRow.id,
        ownerId,
        skillTitle,
        reason,
      })
      if (!archived.ok) {
        return Response.json({ error: archived.error }, { status: 500 })
      }

      return Response.json({
        ok: true,
        action,
        skillId: String(skillRow.id),
        archived: true,
      })
    }

    const { error: deleteError } = await supabaseAdmin.from("skills").delete().eq("id", skillRow.id)
    if (deleteError) {
      if (!isSkillDeleteBlockedError(deleteError)) {
        return Response.json({ error: deleteError.message }, { status: 500 })
      }

      const archived = await archiveSkillForModeration({
        supabaseAdmin,
        adminUserId: user.id,
        skillId: skillRow.id,
        ownerId,
        skillTitle,
        reason,
      })
      if (!archived.ok) {
        return Response.json({ error: archived.error }, { status: 500 })
      }

      return Response.json({
        ok: true,
        action,
        skillId: String(skillRow.id),
        archived: true,
      })
    }

    await notifySkillOwnerModeration({
      supabaseAdmin,
      adminUserId: user.id,
      recipientId: ownerId,
      notificationType: "admin_product_deleted",
      content: `運営対応: 商品「${skillTitle}」を削除しました。理由: ${reason}`,
      emailAction: "deleted",
      skillTitle,
      reason,
    })

    return Response.json({
      ok: true,
      action,
      skillId: String(skillRow.id),
      archived: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to moderate skill"
    return Response.json({ error: message }, { status: 500 })
  }
}
