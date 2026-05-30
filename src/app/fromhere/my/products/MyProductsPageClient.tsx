"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  Archive,
  ArchiveRestore,
  ArrowUp,
  ExternalLink,
  FilePenLine,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import type {
  MyProduct,
  MyProductStatus,
  MyProductsData,
} from "@/fromhere/_my-products-data"
import {
  deleteFromHereProductAction,
  updateFromHereProductStatusAction,
} from "@/fromhere/_product-actions"

/** ----------------------------------------------------------
 *  視覚フォールバック
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return ""
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type Props = {
  data: MyProductsData
}

/**
 * /fromhere/my/products — 自分が投稿したプロダクトの管理画面。
 *
 * - サーバーから受け取った初期データを使い、UI 上の操作後に `router.refresh()` で再取得する。
 * - status の切替は楽観的更新せず、API 応答を待ってからローカル state を反映（誤操作の体感を抑える）。
 * - 削除はモーダル確認 → DELETE API → ローカル state から除去。
 */
export function MyProductsPageClient({ data }: Props) {
  const t = useTranslations("fromhere.myProducts")
  const tFilters = useTranslations("fromhere.filters")
  const router = useRouter()

  const [products, setProducts] = useState<MyProduct[]>(data.products)
  const [stats, setStats] = useState(data.stats)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MyProduct | null>(null)

  const onChangeStatus = async (product: MyProduct, nextStatus: MyProductStatus) => {
    if (pendingStatusId) {
      return
    }
    setPendingStatusId(product.id)
    try {
      const result = await updateFromHereProductStatusAction({
        productId: product.id,
        status: nextStatus,
      })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/products status] action failed", {
            productId: product.id,
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: humanizeServerError(result.error, t) })
        return
      }
      // ローカル state を更新
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, status: nextStatus } : p)),
      )
      setStats((prev) => recomputeStats(prev, product.status, nextStatus))
      setNotice(
        toSuccessNotice(
          t(`notifications.${notificationKeyForStatusChange(product.status, nextStatus)}`),
        ),
      )
      router.refresh()
    } catch (error) {
      setNotice(
        toErrorNotice(error, false, { unknownErrorMessage: t("errors.updateFailed") }),
      )
    } finally {
      setPendingStatusId(null)
    }
  }

  const onConfirmDelete = async () => {
    const product = confirmDelete
    if (!product || deletingId) {
      return
    }
    setDeletingId(product.id)
    try {
      const result = await deleteFromHereProductAction({ productId: product.id })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/products delete] action failed", {
            productId: product.id,
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: humanizeServerError(result.error, t) })
        return
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setStats((prev) => recomputeStats(prev, product.status, null))
      setConfirmDelete(null)
      setNotice(toSuccessNotice(t("notifications.deleted")))
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
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {t("heading")}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/fromhere/submit">
                <Plus className="h-4 w-4" aria-hidden />
                {t("newProduct")}
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <dl className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatPill label={t("stats.total", { count: String(stats.total) })} tone="default" />
            <StatPill
              label={t("stats.published", { count: String(stats.published) })}
              tone="published"
            />
            <StatPill label={t("stats.draft", { count: String(stats.draft) })} tone="draft" />
            <StatPill
              label={t("stats.archived", { count: String(stats.archived) })}
              tone="archived"
            />
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 md:px-8">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <h2 className="text-base font-semibold text-foreground">{t("empty.title")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("empty.body")}</p>
            <Button asChild className="mt-4 gap-2">
              <Link href="/fromhere/submit">
                <Plus className="h-4 w-4" aria-hidden />
                {t("empty.action")}
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <li key={p.id}>
                <ProductRow
                  product={p}
                  categoryLabel={tFilters(
                    `category${p.category.charAt(0).toUpperCase()}${p.category.slice(1)}`,
                  )}
                  statusLabel={t(`status.${p.status}`)}
                  labels={{
                    open: t("actions.viewPublic"),
                    openDraft: t("actions.viewDraft"),
                    edit: t("actions.edit"),
                    publish: t("actions.publish"),
                    unpublish: t("actions.unpublish"),
                    archive: t("actions.archive"),
                    unarchive: t("actions.unarchive"),
                    deleteAction: t("actions.delete"),
                    postedAt: t("labels.postedAt", { date: formatDate(p.postedAt) }),
                    upvotes: t("labels.upvotes", { count: String(p.upvoteCount) }),
                    comments: t("labels.comments", { count: String(p.commentCount) }),
                  }}
                  pending={pendingStatusId === p.id || deletingId === p.id}
                  onChangeStatus={onChangeStatus}
                  onRequestDelete={(target) => setConfirmDelete(target)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmDelete ? (
        <ConfirmDeleteModal
          title={t("confirmDelete.title")}
          body={t("confirmDelete.body", { title: confirmDelete.title })}
          cancelLabel={t("confirmDelete.cancel")}
          confirmLabel={t("confirmDelete.confirm")}
          isProcessing={deletingId !== null}
          onCancel={() => {
            if (!deletingId) {
              setConfirmDelete(null)
            }
          }}
          onConfirm={() => void onConfirmDelete()}
        />
      ) : null}
    </main>
  )
}

/** ----------------------------------------------------------
 *  ステータスバー
 * ---------------------------------------------------------- */
function StatPill({
  label,
  tone,
}: {
  label: string
  tone: "default" | "published" | "draft" | "archived"
}) {
  const toneClass =
    tone === "published"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "draft"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "archived"
          ? "border-zinc-500/30 bg-zinc-500/10 text-muted-foreground"
          : "border-border bg-muted text-foreground"
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", toneClass)}>
      {label}
    </div>
  )
}

/** ----------------------------------------------------------
 *  プロダクト行
 * ---------------------------------------------------------- */
type ProductRowProps = {
  product: MyProduct
  categoryLabel: string
  statusLabel: string
  labels: {
    open: string
    openDraft: string
    edit: string
    publish: string
    unpublish: string
    archive: string
    unarchive: string
    deleteAction: string
    postedAt: string
    upvotes: string
    comments: string
  }
  pending: boolean
  onChangeStatus: (product: MyProduct, next: MyProductStatus) => Promise<void> | void
  onRequestDelete: (product: MyProduct) => void
}

function ProductRow({
  product,
  categoryLabel,
  statusLabel,
  labels,
  pending,
  onChangeStatus,
  onRequestDelete,
}: ProductRowProps) {
  const gradient = pickFallbackGradient(product.id)
  const statusTone =
    product.status === "published"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : product.status === "draft"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-zinc-500/30 bg-zinc-500/10 text-muted-foreground"

  /**
   * 状態遷移ルール（自由遷移）:
   *   - draft → published / archived
   *   - published → draft / archived
   *   - archived → published（再公開のみ。draft 経由が必要なら別 UI で行う）
   *
   * UI を散らかさないよう、各 status において自然な 2 アクション + 削除を出す。
   *
   * 運営により非公開化 (`adminHidden=true`) されている場合、ユーザー側からは
   * status を一切変更できない。アクションボタンはすべて無効化し、警告メッセージを表示する。
   */
  const canPublish = !product.adminHidden && product.status !== "published"
  const canUnpublish = !product.adminHidden && product.status === "published"
  const canArchive = !product.adminHidden && product.status !== "archived"
  const canUnarchive = !product.adminHidden && product.status === "archived"

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl",
            product.appIconUrl ? "bg-muted" : `bg-gradient-to-br ${gradient}`,
          )}
          aria-hidden
        >
          {product.appIconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 画像のプレビュー
            <img src={product.appIconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">{getInitials(product.title)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-base font-bold text-foreground">{product.title}</h3>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                statusTone,
              )}
            >
              {statusLabel}
            </span>
            {product.adminHidden ? (
              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-300">
                運営により非公開
              </span>
            ) : null}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {categoryLabel}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{labels.postedAt}</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <ArrowUp className="h-3 w-3" aria-hidden />
              {labels.upvotes}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageCircle className="h-3 w-3" aria-hidden />
              {labels.comments}
            </span>
          </div>
        </div>
      </div>

      {/* アクション */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/fromhere/p/${product.slug}`}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {product.status === "published" ? labels.open : labels.openDraft}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/fromhere/p/${product.slug}/edit`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {labels.edit}
          </Link>
        </Button>
        {canPublish ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="gap-1.5"
            onClick={() => void onChangeStatus(product, "published")}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {labels.publish}
          </Button>
        ) : null}
        {canUnpublish ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="gap-1.5"
            onClick={() => void onChangeStatus(product, "draft")}
          >
            <FilePenLine className="h-3.5 w-3.5" aria-hidden />
            {labels.unpublish}
          </Button>
        ) : null}
        {canArchive ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="gap-1.5"
            onClick={() => void onChangeStatus(product, "archived")}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            {labels.archive}
          </Button>
        ) : null}
        {canUnarchive ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            className="gap-1.5"
            onClick={() => void onChangeStatus(product, "published")}
          >
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
            {labels.unarchive}
          </Button>
        ) : null}
        <span className="ml-auto" />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => onRequestDelete(product)}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {labels.deleteAction}
        </Button>
      </div>
    </article>
  )
}

/** ----------------------------------------------------------
 *  削除確認モーダル
 * ---------------------------------------------------------- */
type ConfirmDeleteModalProps = {
  title: string
  body: string
  cancelLabel: string
  confirmLabel: string
  isProcessing: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDeleteModal({
  title,
  body,
  cancelLabel,
  confirmLabel,
  isProcessing,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fromhere-confirm-delete-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="fromhere-confirm-delete-title"
          className="text-base font-bold text-foreground"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isProcessing}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isProcessing}
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** ----------------------------------------------------------
 *  ヘルパ
 * ---------------------------------------------------------- */

function notificationKeyForStatusChange(
  from: MyProductStatus,
  to: MyProductStatus,
): "published" | "unpublished" | "archived" | "unarchived" {
  if (to === "published") {
    return from === "archived" ? "unarchived" : "published"
  }
  if (to === "draft") {
    return "unpublished"
  }
  return "archived"
}

function recomputeStats(
  current: { total: number; published: number; draft: number; archived: number },
  from: MyProductStatus,
  to: MyProductStatus | null,
): { total: number; published: number; draft: number; archived: number } {
  const next = { ...current }
  if (from === "published") next.published = Math.max(0, next.published - 1)
  if (from === "draft") next.draft = Math.max(0, next.draft - 1)
  if (from === "archived") next.archived = Math.max(0, next.archived - 1)

  if (to === "published") next.published += 1
  if (to === "draft") next.draft += 1
  if (to === "archived") next.archived += 1
  if (to === null) {
    next.total = Math.max(0, next.total - 1)
  }
  return next
}

function humanizeServerError(
  errorCode: string,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (errorCode) {
    case "forbidden":
      return t("errors.forbidden")
    case "not_found":
      return t("errors.notFound")
    case "rate_limited":
      return t("errors.rateLimited")
    case "invalid_status":
      return t("errors.invalidStatus")
    case "admin_hidden":
      return "運営により非公開化されています。状態を変更するには運営にお問い合わせください。"
    case "banned":
      return "アカウントが停止中のため、この操作は実行できません。"
    case "no_change":
      // 同じ状態への変更は無音 — 念のためメッセージは出さない
      return t("errors.updateFailed")
    case "origin":
    case "internal":
    case "invalid_id":
    default:
      return t("errors.updateFailed")
  }
}
