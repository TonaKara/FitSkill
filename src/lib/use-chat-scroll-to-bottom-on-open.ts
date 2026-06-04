"use client"

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react"
import { scrollElementToBottom, scrollElementToBottomSoon } from "@/lib/chat-scroll-to-bottom"

export type UseChatScrollToBottomOnOpenOptions = {
  /** false の間はスクロールしない（読み込み中等） */
  ready: boolean
  messageCount: number
  /** スレッド・取引 ID など。変わったら開き直し扱い */
  resetKey?: string | number | null
  /** 画像 URL 確定などで高さが変わるときの追従用 */
  layoutKey?: string
  /** 開いた直後に末尾へ追従する時間 (ms) */
  anchorMs?: number
}

/**
 * チャットを開いたとき（PC/スマホ共通）最下部から表示する。
 * 新規メッセージ送信時は返却の `scrollToBottom` を呼ぶ。
 */
export function useChatScrollToBottomOnOpen(
  listRef: RefObject<HTMLElement | null>,
  {
    ready,
    messageCount,
    resetKey,
    layoutKey,
    anchorMs = 6000,
  }: UseChatScrollToBottomOnOpenOptions,
) {
  const scrollAnchorUntilRef = useRef(0)
  const prevResetKeyRef = useRef(resetKey)

  const scrollToBottom = useCallback(() => {
    scrollElementToBottom(listRef.current)
  }, [listRef])

  useLayoutEffect(() => {
    if (resetKey !== prevResetKeyRef.current) {
      prevResetKeyRef.current = resetKey
      scrollAnchorUntilRef.current = 0
    }
  }, [resetKey])

  useLayoutEffect(() => {
    if (!ready) return
    scrollAnchorUntilRef.current = Date.now() + anchorMs
    return scrollElementToBottomSoon(listRef.current)
  }, [ready, messageCount, resetKey, listRef, anchorMs])

  useLayoutEffect(() => {
    if (!ready || layoutKey === undefined) return
    if (scrollAnchorUntilRef.current > 0 && Date.now() > scrollAnchorUntilRef.current) {
      return
    }
    scrollElementToBottom(listRef.current)
  }, [ready, layoutKey, resetKey, listRef])

  return scrollToBottom
}
