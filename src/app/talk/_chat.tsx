"use client"

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ExternalLink,
  EyeOff,
  Loader2,
  Menu,
  Shield,
  X,
  ImagePlus,
  LogOut,
} from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { safeClientLogError } from "@/lib/safe-client-log"
import {
  deleteGritvibChatMessageAction,
  hideGritvibChatMessageAction,
  getGritvibChatSendabilityAction,
  recoverGritvibSubscriptionFromStripeAction,
  sendGritvibChatMessageAction,
} from "@/talk/_chat-actions"
import { ChatImageAttachment } from "@/talk/_chat-image"
import {
  useGritvibChatImageUrls,
  usePreloadGritvibChatImages,
} from "@/lib/talk/chat-image-urls"
import { TALK_STRIPE_LINKS } from "@/talk/_stripe-links"
import { GritvibSubscribeButton } from "@/talk/_subscribe-button"
import {
  createOptimisticGritvibMessage,
  mapGritvibChatMessageRow,
  mergeGritvibChatMessage,
  removeOptimisticGritvibMessage,
  replaceOptimisticGritvibMessage,
  type GritvibChatMessageRow,
  type GritvibChatMessageView,
} from "@/lib/talk/gritvib-chat-message"

/**
 * GritVib (人間チャットサービス) のチャット画面。
 *
 * 仕様:
 *   - スレッドはユーザー (`thread_member_id = userId`) と 1:1。他ユーザーのメッセージは RLS で参照不可。
 *   - 名前は表示しない (自分・相手とも)。位置 (左/右) で区別。
 *   - 自分のメッセージにのみ「×」ボタンを置き、押すと両側完全削除 (物理 DELETE)。
 *   - 相手のメッセージに「非表示」ボタンを置き、自分の画面からだけ隠す (DB は残る)。
 *   - 画像はクライアントから直接 supabase.storage にアップロードし、その path を server action に渡す。
 *   - Supabase Realtime で INSERT / DELETE を購読し、メッセージリストを即時更新。
 *   - サブスク未加入の場合は送信フォームを無効化し、案内を表示。
 */

const STORAGE_BUCKET = "gritvib-chat-photos"
const MESSAGE_BODY_MAX_LENGTH = 2000
const IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const GRITVIB_CHAT_MESSAGE_SELECT =
  "id, thread_member_id, sender_role, sender_user_id, body, image_path, created_at"
const REALTIME_POLL_MS = 5000

type Message = GritvibChatMessageView

export function ChatPage({
  userId,
  nickname,
  accountEmail,
  isAdmin = false,
}: {
  userId: string
  nickname: string
  accountEmail: string
  isAdmin?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  /**
   * `/talk/chat?sub=ok` で着地している場合は、直前に Stripe Checkout を完了した可能性が高い。
   * Webhook での DB 更新は 2〜5 秒のラグがあるため、初回 sendability が false でも
   * 短期間 polling して送信解禁を待つ。
   */
  const justSubscribed = searchParams.get("sub") === "ok"
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [messages, setMessages] = useState<Message[]>([])
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(() => new Set())
  const { getImageUrl, preloadFromMessages } = useGritvibChatImageUrls()
  usePreloadGritvibChatImages(messages, preloadFromMessages)
  const [draft, setDraft] = useState("")
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null)
  const [canSend, setCanSend] = useState<boolean | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  /** Checkout 直後 (`?sub=ok`) の Webhook 反映待ちのみ UI に出す。 */
  const [subscriptionSyncing, setSubscriptionSyncing] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  /** メニュー外クリック / Escape で閉じる。 */
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = menuRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      setMenuOpen(false)
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen])

  const handleSignOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      safeClientLogError("[talk/chat] signOut failed")
    } finally {
      router.replace("/")
      router.refresh()
    }
  }, [router, signingOut, supabase])

  const visibleMessages = useMemo(
    () => messages.filter((m) => !hiddenMessageIds.has(m.id)),
    [messages, hiddenMessageIds],
  )

  const listRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /** メッセージリスト末尾までスクロール。チャット定番の振る舞い。 */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }, [])

  const loadMessages = useCallback(async () => {
    const { data: rows, error: rowsError } = await supabase
      .from("gritvib_chat_messages")
      .select(GRITVIB_CHAT_MESSAGE_SELECT)
      .eq("thread_member_id", userId)
      .order("created_at", { ascending: true })
    if (rowsError) {
      safeClientLogError("[talk/chat] history fetch failed")
      return
    }
    setMessages((rows ?? []).map((row) => mapGritvibChatMessageRow(row as GritvibChatMessageRow)))
  }, [supabase, userId])

  /** 初回ロード: 過去メッセージ + サブスク状態を取得する。 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data: hideRows, error: hideError }, sendability] = await Promise.all([
        supabase.from("gritvib_chat_message_hides").select("message_id"),
        getGritvibChatSendabilityAction(),
      ])
      if (cancelled) return
      await loadMessages()
      if (cancelled) return
      if (hideError) {
        safeClientLogError("[talk/chat] hidden ids fetch failed")
      }
      setHiddenMessageIds(
        new Set((hideRows ?? []).map((row) => row.message_id as string).filter(Boolean)),
      )
      const initialCanSend = sendability.ok ? sendability.canSend : false
      setCanSend(initialCanSend)
      setLoadingHistory(false)
      scrollToBottom()

      /**
       * 初回 `canSend=false` の場合は Webhook 漏れの可能性があるので、
       * 以下の順でリカバリーを試す:
       *   (a) `?sub=ok` で着地している場合は累積 1s / 3s で polling (Webhook 反映待ち)
       *   (b) それでも取れない場合は Stripe を直接照会して DB を即座に同期 (Webhook 漏れ対策)
       *
       * (b) は毎回画面を開くたびに `canSend=false` なら走るが、Stripe API 呼び出しは
       * email でフィルタしているため軽量。真にサブスク未加入のユーザーには
       * `no_subscription` が返るだけで害は無い。
       */
      if (!initialCanSend) {
        if (justSubscribed) {
          setSubscriptionSyncing(true)
        }
        let resolved = false

        if (justSubscribed) {
          const accumulatedDelaysMs = [1000, 3000]
          let prev = 0
          for (const absMs of accumulatedDelaysMs) {
            if (cancelled) break
            await new Promise((r) => setTimeout(r, absMs - prev))
            prev = absMs
            if (cancelled) break
            const retry = await getGritvibChatSendabilityAction()
            if (cancelled) break
            if (retry.ok && retry.canSend) {
              setCanSend(true)
              resolved = true
              break
            }
          }
        }

        /** Webhook 漏れ対策。一般ユーザー向け UI は出さずサーバー側で静かに同期する。 */
        if (!resolved && !cancelled) {
          const recovery = await recoverGritvibSubscriptionFromStripeAction()
          if (!cancelled && recovery.ok && recovery.canSend) {
            setCanSend(true)
            resolved = true
          }
        }

        if (!cancelled) {
          if (justSubscribed) {
            setSubscriptionSyncing(false)
          }
          if (resolved && justSubscribed) {
            router.replace("/talk/chat")
          }
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId, scrollToBottom, justSubscribed, router, loadMessages])

  /** Realtime + 定期同期: 自分のスレッドの INSERT / DELETE。 */
  useEffect(() => {
    const channelId = `gritvib_chat_messages:${userId}`
    const topic = `realtime:${channelId}`
    for (const existing of supabase.getChannels()) {
      if (existing.topic === topic) {
        void supabase.removeChannel(existing)
      }
    }

    const appendFromPayload = (row: GritvibChatMessageRow) => {
      const next = mapGritvibChatMessageRow(row)
      setMessages((prev) => mergeGritvibChatMessage(prev, next))
      scrollToBottom()
    }

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gritvib_chat_messages",
          filter: `thread_member_id=eq.${userId}`,
        },
        (payload) => {
          appendFromPayload(payload.new as GritvibChatMessageRow)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "gritvib_chat_messages",
          filter: `thread_member_id=eq.${userId}`,
        },
        (payload) => {
          const removedId = (payload.old as { id?: string } | null)?.id
          if (!removedId) return
          setMessages((prev) => prev.filter((m) => m.id !== removedId))
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          safeClientLogError("[talk/chat] realtime subscription failed")
        }
      })

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      void loadMessages()
    }, REALTIME_POLL_MS)

    return () => {
      window.clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [supabase, userId, scrollToBottom, loadMessages])

  /** 添付画像の preview を Object URL で生成する。 */
  useEffect(() => {
    if (!pendingImage) {
      setPendingImagePreview(null)
      return
    }
    const url = URL.createObjectURL(pendingImage)
    setPendingImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingImage])

  const handleDraftChange = (value: string) => {
    setDraft(value)
    const node = textareaRef.current
    if (node) {
      node.style.height = "auto"
      node.style.height = `${Math.min(node.scrollHeight, 200)}px`
    }
  }

  const handleAttachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrorMessage("画像形式は JPEG / PNG / WebP / GIF にしてください。")
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setErrorMessage("画像は 5MB までです。")
      return
    }
    setErrorMessage(null)
    setPendingImage(file)
  }

  const handleClearPendingImage = () => {
    setPendingImage(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter で送信
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      void submitMessage()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitMessage()
  }

  const submitMessage = useCallback(async () => {
    if (isSending) return
    const trimmedBody = draft.trim()
    const imageFile = pendingImage
    if (trimmedBody.length === 0 && !imageFile) return
    if (trimmedBody.length > MESSAGE_BODY_MAX_LENGTH) {
      setErrorMessage(`メッセージは ${MESSAGE_BODY_MAX_LENGTH} 文字以内で入力してください。`)
      return
    }
    if (canSend === false) {
      setErrorMessage("サブスクリプションが有効ではないため送信できません。")
      return
    }

    const optimisticId = `pending-${crypto.randomUUID()}`
    let plannedImagePath: string | null = null
    let localImageUrl: string | undefined
    if (imageFile) {
      const ext = guessImageExtension(imageFile.type, imageFile.name)
      plannedImagePath = `${userId}/${crypto.randomUUID()}.${ext}`
      localImageUrl = URL.createObjectURL(imageFile)
    }

    const optimistic = createOptimisticGritvibMessage({
      optimisticId,
      threadMemberId: userId,
      senderRole: "member",
      senderUserId: userId,
      body: trimmedBody.length > 0 ? trimmedBody : null,
      imagePath: plannedImagePath,
      localImageUrl,
    })

    setMessages((prev) => mergeGritvibChatMessage(prev, optimistic))
    setDraft("")
    setPendingImage(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    scrollToBottom()
    setErrorMessage(null)
    setIsSending(true)

    try {
      if (imageFile && plannedImagePath) {
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(plannedImagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false,
          })
        if (uploadError) {
          safeClientLogError("[talk/chat] upload failed")
          setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
          setErrorMessage("画像のアップロードに失敗しました。")
          return
        }
      }

      const result = await sendGritvibChatMessageAction({
        body: trimmedBody,
        imagePath: plannedImagePath,
      })

      if (!result.ok) {
        setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
        if (plannedImagePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([plannedImagePath])
        }
        if (result.reason === "subscription_required") {
          setCanSend(false)
          setErrorMessage("サブスクリプションが有効ではないため送信できません。")
        } else if (result.reason === "unauthenticated") {
          setErrorMessage("セッションが切れました。再ログインしてください。")
        } else if (result.reason === "body_too_long") {
          setErrorMessage(`メッセージは ${MESSAGE_BODY_MAX_LENGTH} 文字以内にしてください。`)
        } else if (result.reason === "empty_payload") {
          setErrorMessage("メッセージを入力してください。")
        } else {
          setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。")
        }
        return
      }

      setMessages((prev) => replaceOptimisticGritvibMessage(prev, optimisticId, result.message))
      scrollToBottom()
    } catch (err) {
      safeClientLogError("[talk/chat] submit error")
      setMessages((prev) => removeOptimisticGritvibMessage(prev, optimisticId))
      if (plannedImagePath) {
        await supabase.storage.from(STORAGE_BUCKET).remove([plannedImagePath])
      }
      setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。")
    } finally {
      if (localImageUrl) {
        URL.revokeObjectURL(localImageUrl)
      }
      setIsSending(false)
    }
  }, [canSend, draft, isSending, pendingImage, scrollToBottom, supabase, userId])

  const handleDeleteMessage = async (messageId: string) => {
    if (messageId.startsWith("pending-")) return
    if (!confirm("このメッセージを削除しますか? 相手側からも見えなくなります。")) return
    const result = await deleteGritvibChatMessageAction(messageId)
    if (!result.ok) {
      safeClientLogError("[talk/chat] delete failed")
      setErrorMessage("削除に失敗しました。時間をおいて再度お試しください。")
      return
    }
    // Realtime DELETE で消えるはずだが、UI の即時反映のためローカルでも除去しておく。
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  const handleHideMessage = async (messageId: string) => {
    if (
      !confirm(
        "このメッセージを非表示にしますか? あなたの画面からだけ消え、相手には残ります。",
      )
    ) {
      return
    }
    const result = await hideGritvibChatMessageAction(messageId)
    if (!result.ok) {
      if (result.reason === "already_hidden") {
        setHiddenMessageIds((prev) => new Set(prev).add(messageId))
        return
      }
      safeClientLogError("[talk/chat] hide failed")
      setErrorMessage("非表示に失敗しました。時間をおいて再度お試しください。")
      return
    }
    setHiddenMessageIds((prev) => new Set(prev).add(messageId))
  }

  const sendDisabled =
    isSending ||
    canSend === false ||
    (draft.trim().length === 0 && !pendingImage)

  return (
    <div className="flex h-[100svh] flex-col bg-white text-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 text-sm">
        <Link
          href="/"
          className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:text-black"
        >
          GritVib
        </Link>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="メニュー"
            disabled={signingOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>

          {menuOpen ? (
            <div
              role="menu"
              aria-label="メニュー"
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
            >
              <div className="border-b border-zinc-100 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                  ニックネーム
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-black">
                  {nickname}
                </p>
              </div>
              <ul className="py-1 text-sm text-black">
                <li>
                  <Link
                    href="/"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center px-3 py-2 hover:bg-zinc-50"
                  >
                    トップへ
                  </Link>
                </li>
                <li>
                  <a
                    href={TALK_STRIPE_LINKS.customerPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center justify-between px-3 py-2 hover:bg-zinc-50"
                  >
                    <span>サブスクを管理</span>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                  </a>
                </li>
                <li>
                  <Link
                    href="/talk/settings/password"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center px-3 py-2 hover:bg-zinc-50"
                  >
                    パスワードを変更
                  </Link>
                </li>
                {isAdmin ? (
                  <li>
                    <Link
                      href="/talk/admin"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-zinc-50"
                    >
                      <Shield className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                      <span>管理画面</span>
                    </Link>
                  </li>
                ) : null}
                <li>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      void handleSignOut()
                    }}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                    <span>ログアウト</span>
                  </button>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10 text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              読み込み中…
            </div>
          ) : visibleMessages.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              {messages.length === 0
                ? "まだメッセージはありません。"
                : "表示できるメッセージはありません。"}
            </p>
          ) : (
            visibleMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.senderUserId === userId}
                imageUrl={
                  message.localImageUrl ??
                  (message.imagePath ? getImageUrl(message.imagePath) : undefined)
                }
                onDelete={
                  message.senderUserId === userId && !message.pending
                    ? () => handleDeleteMessage(message.id)
                    : undefined
                }
                onHide={
                  message.senderUserId !== userId
                    ? () => handleHideMessage(message.id)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </div>

      {canSend === false ? (
        justSubscribed && subscriptionSyncing ? (
          <div className="flex items-center justify-center gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs text-zinc-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <span>接続の準備をしています…</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-xs text-zinc-600">
            <span>サブスクリプションが有効ではないため、メッセージは送信できません。</span>
            <GritvibSubscribeButton accountEmail={accountEmail} />
          </div>
        )
      ) : null}

      {errorMessage ? (
        <p
          className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-600"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="border-t border-zinc-200 px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {pendingImagePreview ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element -- ローカル preview */}
              <img
                src={pendingImagePreview}
                alt="送信予定の画像"
                className="max-h-32 max-w-[12rem] rounded-md border border-zinc-200 object-contain"
              />
              <button
                type="button"
                onClick={handleClearPendingImage}
                aria-label="画像を取り消す"
                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAttachImage}
              disabled={isSending || canSend === false}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || canSend === false}
              aria-label="画像を添付"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ImagePlus className="h-5 w-5" aria-hidden />
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                canSend === false ? "送信できません" : "人間は、もっと自由で良いのです"
              }
              rows={1}
              maxLength={MESSAGE_BODY_MAX_LENGTH}
              disabled={canSend === false}
              className="block max-h-[200px] w-full resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm leading-relaxed text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
            />

            <button
              type="submit"
              disabled={sendDisabled}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "送る"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({
  message,
  isMine,
  imageUrl,
  onDelete,
  onHide,
}: {
  message: Message
  isMine: boolean
  imageUrl?: string
  onDelete?: () => void
  onHide?: () => void
}) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className="group relative max-w-[80%]">
        {onHide ? (
          <button
            type="button"
            onClick={onHide}
            aria-label="メッセージを非表示"
            className="absolute -left-2 -top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 shadow-sm transition-opacity hover:text-black focus:opacity-100 group-hover:opacity-100"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label="メッセージを削除"
            className="absolute -right-2 -top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 shadow-sm transition-opacity hover:text-black focus:opacity-100 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}

        <div
          className={[
            "overflow-hidden rounded-2xl text-sm leading-relaxed",
            isMine
              ? "bg-black text-white"
              : "border border-zinc-200 bg-white text-black",
            message.pending ? "opacity-90" : "",
          ].join(" ")}
        >
          {message.imagePath ? (
            <ChatImageAttachment
              imagePath={message.imagePath}
              imageUrl={imageUrl}
            />
          ) : null}
          {message.body ? (
            <p className="whitespace-pre-wrap break-words px-4 py-3">{message.body}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function guessImageExtension(mimeType: string, filename: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    case "image/gif":
      return "gif"
    default: {
      const idx = filename.lastIndexOf(".")
      if (idx >= 0) {
        const ext = filename.slice(idx + 1).toLowerCase()
        if (ext.length >= 2 && ext.length <= 5) return ext
      }
      return "bin"
    }
  }
}
