"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  ADMIN_REVIEW_ICONS_BUCKET,
  ADMIN_REVIEW_LIMITS,
  type AdminReviewInputErrorKey,
} from "@/fromhere/_admin-review-validation"
import {
  createFromHereAdminReviewAction,
  deleteFromHereAdminReviewAction,
  updateFromHereAdminReviewAction,
} from "@/fromhere/_admin-review-actions"

type Mode = "create" | "edit"

export type AdminReviewFormInitial = {
  id?: string
  title: string
  summary: string
  body: string
  iconPath: string | null
  iconUrl: string | null
  status: "draft" | "published"
}

type Props = {
  mode: Mode
  initial: AdminReviewFormInitial
}

const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
const MAX_FILE_SIZE = 2 * 1024 * 1024

export function AdminReviewForm({ mode, initial }: Props) {
  const t = useTranslations("fromhere.adminReviews")
  const tErr = useTranslations("fromhere.adminReviews.errors")
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [title, setTitle] = useState(initial.title)
  const [summary, setSummary] = useState(initial.summary)
  const [body, setBody] = useState(initial.body)
  const [status, setStatus] = useState<"draft" | "published">(initial.status)
  const [iconPath, setIconPath] = useState<string | null>(initial.iconPath)
  const [iconUrl, setIconUrl] = useState<string | null>(initial.iconUrl)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [errors, setErrors] = useState<Set<AdminReviewInputErrorKey>>(new Set())

  const titleCount = useMemo(() => title.length, [title])
  const summaryCount = useMemo(() => summary.length, [summary])
  const bodyCount = useMemo(() => body.length, [body])

  const handleSelectFile = () => {
    fileInputRef.current?.click()
  }

  const handleFile = async (file: File) => {
    if (!ACCEPTED_MIME.includes(file.type)) {
      setNotice({ variant: "error", message: tErr("iconInvalid") })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setNotice({ variant: "error", message: tErr("iconTooLarge") })
      return
    }
    setUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const extMatch = /\.(png|jpg|jpeg|webp|svg)$/i.exec(file.name)
      const ext = extMatch ? extMatch[1]!.toLowerCase() : "png"
      const filename = `${cryptoRandomId()}.${ext}`
      const path = `${filename}`
      const { error: uploadError } = await supabase.storage
        .from(ADMIN_REVIEW_ICONS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) {
        setNotice(toErrorNotice(uploadError, false, { unknownErrorMessage: t("uploadFailed") }))
        return
      }
      const { data: publicUrl } = supabase.storage
        .from(ADMIN_REVIEW_ICONS_BUCKET)
        .getPublicUrl(path)
      setIconPath(path)
      setIconUrl(publicUrl.publicUrl ?? null)
    } catch (err) {
      setNotice(toErrorNotice(err, false, { unknownErrorMessage: t("uploadFailed") }))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemoveIcon = async () => {
    if (!iconPath) {
      setIconUrl(null)
      return
    }
    /**
     * Storage 上のファイルも削除する（残しても害は少ないが、容量節約のため）。
     * UI 上は楽観的に消し、storage の削除エラーは静かに無視する。
     */
    try {
      const supabase = getSupabaseBrowserClient()
      await supabase.storage.from(ADMIN_REVIEW_ICONS_BUCKET).remove([iconPath])
    } catch {
      /* 削除失敗は通知しない（DB 上の参照は外すので実害なし） */
    }
    setIconPath(null)
    setIconUrl(null)
  }

  const handleDelete = async () => {
    if (mode !== "edit" || !initial.id) return
    if (deleting || submitting) return
    if (!window.confirm(t("deleteConfirm"))) return
    setDeleting(true)
    try {
      const result = await deleteFromHereAdminReviewAction({ id: initial.id })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/admin/reviews delete] action failed", {
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: t("deleteFailed") })
        return
      }
      /**
       * 削除後はアイコン画像も Storage から削除する（残しても害は薄いが、
       * 不要ファイルを溜めないために）。失敗してもユーザー操作は完了扱い。
       */
      if (iconPath) {
        try {
          const supabase = getSupabaseBrowserClient()
          await supabase.storage.from(ADMIN_REVIEW_ICONS_BUCKET).remove([iconPath])
        } catch {
          /* 削除失敗は通知しない */
        }
      }
      setNotice({ variant: "success", message: t("deleteSuccess") })
      router.push("/fromhere/admin/reviews")
      router.refresh()
    } catch (err) {
      setNotice(toErrorNotice(err, false, { unknownErrorMessage: t("deleteFailed") }))
    } finally {
      setDeleting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setErrors(new Set())
    setSubmitting(true)
    try {
      const result =
        mode === "create"
          ? await createFromHereAdminReviewAction({
              title,
              summary,
              body,
              iconPath,
              iconUrl,
              status,
            })
          : await updateFromHereAdminReviewAction({
              id: initial.id,
              title,
              summary,
              body,
              iconPath,
              iconUrl,
              status,
            })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/admin/reviews submit] action failed", {
            mode,
            errorKey: result.error,
            validationErrors: result.errors,
          })
        }
        if (result.error === "validation" && result.errors) {
          setErrors(new Set(result.errors))
          setNotice({ variant: "error", message: t("validationFailed") })
        } else {
          setNotice({ variant: "error", message: t("saveFailed") })
        }
        return
      }
      setNotice({ variant: "success", message: t("saveSuccess") })
      /**
       * 完了後の遷移先:
       *   - 新規作成 (`create`) → FromHere トップへ (`/fromhere`) 戻り、公開直後の
       *     並びを確認できるようにする。
       *   - 更新 (`edit`) → 既存通りレビュー管理一覧 (`/fromhere/admin/reviews`) へ。
       *     管理操作の流れを途切れさせないため。
       */
      router.push(mode === "create" ? "/fromhere" : "/fromhere/admin/reviews")
      router.refresh()
    } catch (err) {
      setNotice(toErrorNotice(err, false, { unknownErrorMessage: t("saveFailed") }))
    } finally {
      setSubmitting(false)
    }
  }

  const titleOver = titleCount > ADMIN_REVIEW_LIMITS.TITLE_MAX
  const summaryOver = summaryCount > ADMIN_REVIEW_LIMITS.SUMMARY_MAX
  const bodyOver = bodyCount > ADMIN_REVIEW_LIMITS.BODY_MAX

  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-3xl px-4 py-8 md:px-8">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <h1 className="text-2xl font-bold text-foreground md:text-3xl">
        {mode === "create" ? t("createTitle") : t("editTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("formSubtitle")}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* アイコン画像 */}
        <div>
          <span className="text-sm font-semibold text-foreground">{t("iconLabel")}</span>
          <p className="mt-1 text-xs text-muted-foreground">{t("iconHelp")}</p>
          <div className="mt-3 flex items-center gap-4">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開URL
              <img
                src={iconUrl}
                alt=""
                className="h-20 w-20 rounded-2xl border border-border object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
                aria-hidden
              >
                <Upload className="h-6 w-6" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME.join(",")}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    void handleFile(file)
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleSelectFile} disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                    {t("uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="mr-1 h-4 w-4" aria-hidden />
                    {iconUrl ? t("iconReplace") : t("iconUpload")}
                  </>
                )}
              </Button>
              {iconUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemoveIcon()}>
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                  {t("iconRemove")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* タイトル */}
        <div>
          <label htmlFor="ar-title" className="text-sm font-semibold text-foreground">
            {t("titleLabel")}
            <span className="ml-1 text-rose-500">*</span>
          </label>
          <Input
            id="ar-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className={cn(
              "mt-2",
              (titleOver || errors.has("titleRequired") || errors.has("titleTooLong")) &&
                "border-rose-500",
            )}
            required
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {errors.has("titleRequired")
                ? tErr("titleRequired")
                : errors.has("titleTooLong") || titleOver
                  ? tErr("titleTooLong")
                  : ""}
            </span>
            <span className={cn("tabular-nums", titleOver && "text-rose-500")}>
              {titleCount}/{ADMIN_REVIEW_LIMITS.TITLE_MAX}
            </span>
          </div>
        </div>

        {/* 短文 */}
        <div>
          <label htmlFor="ar-summary" className="text-sm font-semibold text-foreground">
            {t("summaryLabel")}
            <span className="ml-1 text-rose-500">*</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t("summaryHelp")}</p>
          <textarea
            id="ar-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("summaryPlaceholder")}
            rows={2}
            className={cn(
              "mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              (summaryOver || errors.has("summaryRequired") || errors.has("summaryTooLong")) &&
                "border-rose-500",
            )}
            required
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {errors.has("summaryRequired")
                ? tErr("summaryRequired")
                : errors.has("summaryTooLong") || summaryOver
                  ? tErr("summaryTooLong")
                  : ""}
            </span>
            <span className={cn("tabular-nums", summaryOver && "text-rose-500")}>
              {summaryCount}/{ADMIN_REVIEW_LIMITS.SUMMARY_MAX}
            </span>
          </div>
        </div>

        {/* 本文 */}
        <div>
          <label htmlFor="ar-body" className="text-sm font-semibold text-foreground">
            {t("bodyLabel")}
            <span className="ml-1 text-rose-500">*</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">{t("bodyHelp")}</p>
          <textarea
            id="ar-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("bodyPlaceholder")}
            rows={10}
            className={cn(
              "mt-2 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              (bodyOver || errors.has("bodyRequired") || errors.has("bodyTooLong")) &&
                "border-rose-500",
            )}
            required
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>
              {errors.has("bodyRequired")
                ? tErr("bodyRequired")
                : errors.has("bodyTooLong") || bodyOver
                  ? tErr("bodyTooLong")
                  : ""}
            </span>
            <span className={cn("tabular-nums", bodyOver && "text-rose-500")}>
              {bodyCount}/{ADMIN_REVIEW_LIMITS.BODY_MAX}
            </span>
          </div>
        </div>

        {/* ステータス */}
        <div>
          <span className="text-sm font-semibold text-foreground">{t("statusLabel")}</span>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("draft")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                status === "draft"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              {t("status.draft")}
            </button>
            <button
              type="button"
              onClick={() => setStatus("published")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                status === "published"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              {t("status.published")}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-stretch justify-between gap-3 pt-4 sm:flex-row sm:items-center">
          {mode === "edit" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleDelete()}
              disabled={deleting || submitting || uploading}
              className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                  {t("delete")}
                </>
              )}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/fromhere/admin/reviews")}
              disabled={deleting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || uploading || deleting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          </div>
        </div>
      </form>
    </main>
  )
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "")
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}
