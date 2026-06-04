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

/** 送信待ちの楽観メッセージかどうか。 */
export function isPendingGritvibChatMessage(m: GritvibChatMessageView): boolean {
  return m.pending === true || m.id.startsWith("pending-")
}

function gritvibChatMessageContentKey(
  m: Pick<GritvibChatMessage, "senderRole" | "senderUserId" | "body" | "imagePath">,
): string {
  return `${m.senderRole}:${m.senderUserId}:${m.body ?? ""}:${m.imagePath ?? ""}`
}

/** 楽観表示とサーバー確定メッセージが同一内容か（重複表示の判定用）。 */
export function gritvibPendingMatchesConfirmed(
  pending: GritvibChatMessageView,
  confirmed: GritvibChatMessage,
): boolean {
  return gritvibChatMessageContentKey(pending) === gritvibChatMessageContentKey(confirmed)
}

function filterPendingWithoutConfirmedMatch(
  pending: GritvibChatMessageView[],
  confirmed: GritvibChatMessage[],
): GritvibChatMessageView[] {
  return pending.filter(
    (p) => !confirmed.some((c) => gritvibPendingMatchesConfirmed(p, c)),
  )
}

/**
 * サーバーから再取得した一覧とローカル state をマージする。
 * 定期同期で楽観表示が一瞬消えるのを防ぐ。
 */
export function reconcileGritvibChatMessagesFromServer(
  prev: GritvibChatMessageView[],
  fetched: GritvibChatMessage[],
): GritvibChatMessageView[] {
  const stillPending = filterPendingWithoutConfirmedMatch(
    prev.filter(isPendingGritvibChatMessage),
    fetched,
  )
  let next: GritvibChatMessageView[] = [...fetched]
  for (const p of stillPending) {
    next = mergeGritvibChatMessage(next, p)
  }
  return next
}

/** Realtime INSERT 時: 同一内容の楽観表示を除去してからマージする。 */
export function mergeGritvibChatMessageAfterRealtime(
  prev: GritvibChatMessageView[],
  incoming: GritvibChatMessage,
): GritvibChatMessageView[] {
  const withoutMatchingPending = prev.filter(
    (m) =>
      !(isPendingGritvibChatMessage(m) && gritvibPendingMatchesConfirmed(m, incoming)),
  )
  return mergeGritvibChatMessage(withoutMatchingPending, incoming)
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
