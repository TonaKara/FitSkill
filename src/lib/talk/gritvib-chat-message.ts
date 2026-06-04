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
export function mergeGritvibChatMessage(
  prev: GritvibChatMessage[],
  next: GritvibChatMessage,
): GritvibChatMessage[] {
  if (prev.some((m) => m.id === next.id)) {
    return prev
  }
  return [...prev, next].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
