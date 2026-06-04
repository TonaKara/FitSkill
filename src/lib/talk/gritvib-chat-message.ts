/** GritVib チャットメッセージ（会員 UI / 管理 UI 共通の形）。 */
export type GritvibChatMessage = {
  id: string
  threadMemberId: string
  senderRole: "member" | "operator"
  senderUserId: string
  body: string | null
  imagePath: string | null
  createdAt: string
}

/** 送信直後の楽観表示用（サーバー確定前）。 */
export type GritvibChatMessageView = GritvibChatMessage & {
  pending?: boolean
  /** 画像アップロード完了前のローカル preview URL (blob:)。 */
  localImageUrl?: string
}

export function createOptimisticGritvibMessage(input: {
  optimisticId: string
  threadMemberId: string
  senderRole: "member" | "operator"
  senderUserId: string
  body: string | null
  imagePath: string | null
  localImageUrl?: string
}): GritvibChatMessageView {
  return {
    id: input.optimisticId,
    threadMemberId: input.threadMemberId,
    senderRole: input.senderRole,
    senderUserId: input.senderUserId,
    body: input.body,
    imagePath: input.imagePath,
    createdAt: new Date().toISOString(),
    pending: true,
    localImageUrl: input.localImageUrl,
  }
}

export function replaceOptimisticGritvibMessage(
  prev: GritvibChatMessageView[],
  optimisticId: string,
  confirmed: GritvibChatMessage,
): GritvibChatMessageView[] {
  const without = prev.filter((m) => m.id !== optimisticId)
  return mergeGritvibChatMessage(without, confirmed)
}

export function removeOptimisticGritvibMessage(
  prev: GritvibChatMessageView[],
  optimisticId: string,
): GritvibChatMessageView[] {
  return prev.filter((m) => m.id !== optimisticId)
}

export type GritvibChatMessageRow = {
  id: string
  thread_member_id: string
  sender_role: "member" | "operator"
  sender_user_id: string
  body: string | null
  image_path: string | null
  created_at: string
}

export function mapGritvibChatMessageRow(row: GritvibChatMessageRow): GritvibChatMessage {
  return {
    id: row.id,
    threadMemberId: row.thread_member_id,
    senderRole: row.sender_role,
    senderUserId: row.sender_user_id,
    body: row.body,
    imagePath: row.image_path,
    createdAt: row.created_at,
  }
}

/** Realtime / 送信直後の重複挿入を防ぎつつ時系列でマージする。 */
export function mergeGritvibChatMessage<T extends GritvibChatMessage>(
  prev: T[],
  next: T,
): T[] {
  if (prev.some((m) => m.id === next.id)) {
    return prev
  }
  return [...prev, next].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
