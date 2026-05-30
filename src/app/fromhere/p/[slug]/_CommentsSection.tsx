"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { MessageCircle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import {
  deleteFromHereCommentAction,
  submitFromHereCommentAction,
  type FromHereCommentActionError,
  type SubmitFromHereCommentResult,
} from "@/fromhere/_comment-actions"
import {
  FROMHERE_COMMENT_MAX_LENGTH,
  validateFromHereCommentInput,
} from "@/fromhere/_comment-validation"
import type { ProductComment } from "@/fromhere/_product-detail-data"

/** ----------------------------------------------------------
 *  視覚フォールバック（メーカーアバター用）
 * ---------------------------------------------------------- */
const FALLBACK_GRADIENTS = [
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-sky-500",
  "from-fuchsia-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-orange-500 to-red-500",
  "from-teal-500 to-cyan-500",
  "from-yellow-400 to-orange-500",
  "from-rose-500 to-violet-500",
] as const

function pickFallbackGradient(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return FALLBACK_GRADIENTS[Math.abs(hash) % FALLBACK_GRADIENTS.length]!
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return "?"
  }
  if (/^[\x20-\x7e]+$/.test(trimmed)) {
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
    }
  }
  return trimmed.slice(0, 1).toUpperCase()
}

function formatRelativeTime(iso: string, locale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  // 1 日以内なら「N分前 / N時間前」、それ以降は yyyy-mm-dd 形式
  if (diff < minute) {
    return locale === "ja" ? "たった今" : "just now"
  }
  if (diff < hour) {
    const m = Math.floor(diff / minute)
    return locale === "ja" ? `${m}分前` : `${m}m ago`
  }
  if (diff < day) {
    const h = Math.floor(diff / hour)
    return locale === "ja" ? `${h}時間前` : `${h}h ago`
  }
  if (diff < 7 * day) {
    const d = Math.floor(diff / day)
    return locale === "ja" ? `${d}日前` : `${d}d ago`
  }
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, "0")
  const da = String(date.getDate()).padStart(2, "0")
  return `${y}-${mo}-${da}`
}

/** ----------------------------------------------------------
 *  Server Action 結果型のエイリアス
 *  （humanizeError でエラーキーを参照するため、ここで再エクスポートだけ行う）
 * ---------------------------------------------------------- */

type SubmitResult = SubmitFromHereCommentResult
type ActionError = { ok: false; error: FromHereCommentActionError }

/** ----------------------------------------------------------
 *  プロパティ
 * ---------------------------------------------------------- */

type Props = {
  productId: string
  productSlug: string
  initialComments: ProductComment[]
  initialCount: number
  viewerIsAuthenticated: boolean
  viewerHasProfile: boolean
  locale: "ja" | "en"
}

/** プロダクト詳細ページのコメントセクション */
export function CommentsSection({
  productId,
  productSlug,
  initialComments,
  initialCount,
  viewerIsAuthenticated,
  viewerHasProfile,
  locale,
}: Props) {
  const t = useTranslations("fromhere.comments")
  const tDetail = useTranslations("fromhere.detail")
  const router = useRouter()
  const { user, profile } = useFromHereAuth()

  // クライアント側の comment list は楽観的更新で reactive に保つ
  const [comments, setComments] = useState<ProductComment[]>(initialComments)
  const [commentCount, setCommentCount] = useState<number>(initialCount)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  /**
   * `router.refresh()` 経由でサーバーから最新の comments / count が来ても、
   * useState の初期値は再評価されないため、ローカル state がズレ続けてしまう。
   * 自分が直前に楽観的に追加した分を保護しつつ、サーバー側の最新一覧で同期する。
   */
  const optimisticIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    setComments((prev) => {
      const merged: ProductComment[] = [...initialComments]
      for (const c of prev) {
        if (optimisticIdsRef.current.has(c.id) && !merged.some((m) => m.id === c.id)) {
          merged.push(c)
        }
      }
      return merged
    })
    setCommentCount((prev) => Math.max(prev, initialCount))
  }, [initialComments, initialCount])

  const trimmedLength = body.trim().length
  const remaining = FROMHERE_COMMENT_MAX_LENGTH - body.length

  // useFromHereAuth の状態が SSR 時よりも更新された場合に追従する
  const isAuthenticatedClient = Boolean(user?.id) || viewerIsAuthenticated
  const hasProfileClient = Boolean(profile) || viewerHasProfile

  const signinHref = `/fromhere/signin?next=${encodeURIComponent(`/fromhere/p/${productSlug}`)}`

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) {
      return
    }
    const validation = validateFromHereCommentInput({
      body,
      productId,
    })
    if (!validation.ok) {
      // クライアント検証エラーもサーバーエラーと同じ humanizer で処理し、文言を一本化する
      setNotice({
        variant: "error",
        message: humanizeError({ ok: false, error: validation.error }, t),
      })
      return
    }

    setSubmitting(true)
    try {
      const result: SubmitResult = await submitFromHereCommentAction({
        body: validation.value.body,
        productId: validation.value.productId,
      })

      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/comments submit] action failed", {
            productId: validation.value.productId,
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: humanizeError(result, t) })
        return
      }

      // 楽観的に list に追加 + プロフィール情報を埋める
      const newEntry: ProductComment = {
        id: result.comment.id,
        body: result.comment.body,
        createdAt: result.comment.created_at,
        parentId: result.comment.parent_id,
        author: {
          id: result.comment.user_id,
          handle: profile?.handle ?? "",
          displayName: profile?.display_name ?? "",
          avatarUrl: profile?.avatar_url ?? null,
        },
        isOwn: true,
      }
      optimisticIdsRef.current.add(newEntry.id)
      setComments((prev) =>
        prev.some((c) => c.id === newEntry.id) ? prev : [...prev, newEntry],
      )
      setCommentCount((prev) => prev + 1)
      setBody("")
      setNotice(toSuccessNotice(t("successPosted")))
      // サーバーの cache を refresh して count / list を整合させる
      router.refresh()
    } catch (error) {
      setNotice(
        toErrorNotice(error, false, { unknownErrorMessage: t("errors.postFailed") }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (commentId: string) => {
    if (deletingId) {
      return
    }
    const confirmed = window.confirm(t("confirmDelete"))
    if (!confirmed) {
      return
    }
    setDeletingId(commentId)
    try {
      const result = await deleteFromHereCommentAction({ commentId })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/comments delete] action failed", {
            commentId,
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: t("errors.deleteFailed") })
        return
      }
      optimisticIdsRef.current.delete(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setCommentCount((prev) => Math.max(0, prev - 1))
      setNotice(toSuccessNotice(t("successDeleted")))
      router.refresh()
    } catch (error) {
      setNotice(
        toErrorNotice(error, false, { unknownErrorMessage: t("errors.deleteFailed") }),
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section id="comments" aria-labelledby="fromhere-comments-heading" className="scroll-mt-20">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <h2
        id="fromhere-comments-heading"
        className="flex items-center gap-2 text-lg font-bold text-foreground"
      >
        <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
        {tDetail("commentsHeading")}
        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {commentCount}
        </span>
      </h2>

      {/* 投稿フォーム or ログイン誘導 */}
      <div className="mt-4">
        {!isAuthenticatedClient ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-5 text-sm">
            <p className="text-muted-foreground">{t("loginPrompt")}</p>
            <Button asChild variant="default" size="sm" className="mt-3">
              <Link href={signinHref}>{t("loginAction")}</Link>
            </Button>
          </div>
        ) : !hasProfileClient ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-5 text-sm">
            <p className="text-muted-foreground">{t("needsOnboarding")}</p>
            <Button asChild variant="default" size="sm" className="mt-3">
              <Link href="/fromhere/onboarding">{t("needsOnboardingAction")}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-4">
            <label htmlFor="fromhere_comment_body" className="sr-only">
              {t("placeholder")}
            </label>
            <textarea
              id="fromhere_comment_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={FROMHERE_COMMENT_MAX_LENGTH + 200 /* 視覚的に少しだけ余裕を持たせ、サーバーで再検証 */}
              placeholder={t("placeholder")}
              disabled={submitting}
              className={cn(
                "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                submitting && "opacity-60",
              )}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span
                className={cn(
                  "text-xs tabular-nums",
                  remaining < 0 ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {t("remaining", {
                  remaining: String(body.length),
                  max: String(FROMHERE_COMMENT_MAX_LENGTH),
                })}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || trimmedLength === 0 || body.length > FROMHERE_COMMENT_MAX_LENGTH}
              >
                {submitting ? t("submitting") : t("submit")}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* 一覧 */}
      <ul className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <li>
            <p className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          </li>
        ) : (
          comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <CommentRow
                comment={c}
                onDelete={() => void onDelete(c.id)}
                isDeleting={deletingId === c.id}
                labels={{
                  delete: t("delete"),
                  deleting: t("deleting"),
                  openProfile: t("openProfile"),
                }}
                locale={locale}
              />
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

/** ----------------------------------------------------------
 *  単一コメント行
 * ---------------------------------------------------------- */

type CommentRowProps = {
  comment: ProductComment
  onDelete: () => void
  isDeleting: boolean
  labels: { delete: string; deleting: string; openProfile: string }
  locale: "ja" | "en"
}

function CommentRow({ comment, onDelete, isDeleting, labels, locale }: CommentRowProps) {
  const gradient = pickFallbackGradient(comment.author.id || comment.id)
  const displayName = comment.author.displayName || comment.author.handle || "?"
  const handle = comment.author.handle
  const time = formatRelativeTime(comment.createdAt, locale)

  return (
    <div className="flex items-start gap-3">
      {comment.author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
        <img
          src={comment.author.avatarUrl}
          alt={displayName}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <div
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ring-1 ring-border",
            gradient,
          )}
        >
          {getInitials(displayName)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
          {handle ? (
            <Link
              href={`/fromhere/u/${handle}`}
              className="font-semibold text-foreground hover:text-primary-readable hover:underline"
              title={labels.openProfile}
            >
              {displayName}
            </Link>
          ) : (
            <span className="font-semibold text-foreground">{displayName}</span>
          )}
          {handle ? <span className="text-muted-foreground">@{handle}</span> : null}
          {time ? (
            <>
              <span className="text-muted-foreground">·</span>
              <time dateTime={comment.createdAt} className="text-muted-foreground">
                {time}
              </time>
            </>
          ) : null}
        </div>
        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
          {comment.body}
        </p>
      </div>
      {comment.isOwn ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className={cn(
            "ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive",
            isDeleting && "opacity-60",
          )}
          aria-label={labels.delete}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">{isDeleting ? labels.deleting : labels.delete}</span>
        </button>
      ) : null}
    </div>
  )
}

/** ----------------------------------------------------------
 *  エラーレスポンスの人間向けメッセージ化
 * ---------------------------------------------------------- */
function humanizeError(
  res: ActionError,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (res.error) {
    case "empty":
      return t("errors.empty")
    case "tooLong":
      return t("errors.tooLong", { max: String(FROMHERE_COMMENT_MAX_LENGTH) })
    case "rate_limited":
      return t("errors.rateLimited")
    case "needs_profile":
      return t("needsOnboarding")
    case "unauthorized":
      return t("errors.unauthorized")
    case "containsHtml":
      return t("errors.containsHtml")
    case "product_not_found":
    case "not_found":
      return t("errors.productMissing")
    case "forbidden":
    case "invalid_id":
    case "invalidProductId":
    case "invalidParentId":
    case "internal":
    default:
      return t("errors.postFailed")
  }
}
