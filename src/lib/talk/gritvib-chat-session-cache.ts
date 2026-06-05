import type { GritvibChatMessageView } from "@/lib/talk/gritvib-chat-message"

export type GritvibMemberChatCache = {
  messages: GritvibChatMessageView[]
  hiddenMessageIds: string[]
}

const memberChatByUserId = new Map<string, GritvibMemberChatCache>()
const memberChatHydrated = new Set<string>()

const adminThreadByMemberId = new Map<string, GritvibChatMessageView[]>()
const adminThreadHydrated = new Set<string>()

function withoutPending(messages: GritvibChatMessageView[]): GritvibChatMessageView[] {
  return messages.filter((m) => !m.pending && !m.id.startsWith("pending-"))
}

export function readMemberChatCache(userId: string): GritvibMemberChatCache | null {
  if (!memberChatHydrated.has(userId)) {
    return null
  }
  return memberChatByUserId.get(userId) ?? { messages: [], hiddenMessageIds: [] }
}

export function writeMemberChatCache(userId: string, data: GritvibMemberChatCache): void {
  memberChatHydrated.add(userId)
  memberChatByUserId.set(userId, {
    messages: withoutPending(data.messages),
    hiddenMessageIds: data.hiddenMessageIds,
  })
}

export function readAdminThreadCache(threadMemberId: string): GritvibChatMessageView[] | null {
  if (!adminThreadHydrated.has(threadMemberId)) {
    return null
  }
  return adminThreadByMemberId.get(threadMemberId) ?? []
}

export function writeAdminThreadCache(
  threadMemberId: string,
  messages: GritvibChatMessageView[],
): void {
  adminThreadHydrated.add(threadMemberId)
  adminThreadByMemberId.set(threadMemberId, withoutPending(messages))
}
