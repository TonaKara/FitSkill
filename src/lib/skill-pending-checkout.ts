/** 決済ページへ遷移する直前に保存し、戻り方に関係なく未払いなら解放 RPC を呼べるようにする */

const STORAGE_KEY = "fitskill_pending_skill_checkout_v1"

export type PendingSkillCheckout = {
  skillId: string
  sessionId: string
  /** writePendingSkillCheckout 時の `Date.now()`。猶予時間内は abandon 解放をスキップする */
  createdAt?: number
}

export function readPendingSkillCheckout(): PendingSkillCheckout | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw?.trim()) {
      return null
    }
    const parsed = JSON.parse(raw) as Partial<PendingSkillCheckout>
    const skillId = String(parsed.skillId ?? "").trim()
    const sessionId = String(parsed.sessionId ?? "").trim()
    if (!skillId || !sessionId) {
      return null
    }
    const createdAt =
      typeof parsed.createdAt === "number" && Number.isFinite(parsed.createdAt) ? parsed.createdAt : undefined
    return createdAt !== undefined ? { skillId, sessionId, createdAt } : { skillId, sessionId }
  } catch {
    return null
  }
}

export function writePendingSkillCheckout(payload: PendingSkillCheckout): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearPendingSkillCheckout(): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.removeItem(STORAGE_KEY)
}
