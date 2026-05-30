"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Edit3, ExternalLink, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import type { AdminReviewListItem } from "@/fromhere/_admin-reviews-data"
import { deleteFromHereAdminReviewAction } from "@/fromhere/_admin-review-actions"

type Props = {
  initialReviews: AdminReviewListItem[]
}

export function AdminReviewsListClient({ initialReviews }: Props) {
  const t = useTranslations("fromhere.adminReviews")
  const router = useRouter()
  const [reviews, setReviews] = useState<AdminReviewListItem[]>(initialReviews)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (deletingId) return
    if (!window.confirm(t("deleteConfirm"))) return
    setDeletingId(id)
    try {
      const result = await deleteFromHereAdminReviewAction({ id })
      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/admin/reviews delete] action failed", {
            id,
            errorKey: result.error,
          })
        }
        setNotice({ variant: "error", message: t("deleteFailed") })
        return
      }
      setReviews((prev) => prev.filter((r) => r.id !== id))
      setNotice({ variant: "success", message: t("deleteSuccess") })
    } catch (err) {
      setNotice(toErrorNotice(err, false, { unknownErrorMessage: t("deleteFailed") }))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto box-border w-full min-w-0 max-w-7xl px-4 py-8 md:px-8">
      {notice ? (
        <NotificationToast notice={notice} onClose={() => setNotice(null)} />
      ) : null}

      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => router.push("/fromhere/admin/reviews/new")}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {t("create")}
        </Button>
      </header>

      {reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-base font-semibold text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Button asChild className="mt-5">
            <Link href="/fromhere/admin/reviews/new">
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              {t("create")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("colIcon")}</th>
                <th className="px-4 py-3">{t("colTitle")}</th>
                <th className="px-4 py-3">{t("colSummary")}</th>
                <th className="px-4 py-3">{t("colStatus")}</th>
                <th className="px-4 py-3">{t("colUpdated")}</th>
                <th className="px-4 py-3 text-right">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviews.map((review) => (
                <tr key={review.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    {review.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 公開URL のためそのまま <img>
                      <img
                        src={review.iconUrl}
                        alt=""
                        className="h-10 w-10 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-rose-500 text-sm font-semibold text-white"
                        aria-hidden
                      >
                        {review.title.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-foreground">{review.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">/{review.slug}</p>
                  </td>
                  <td className="max-w-md px-4 py-3 align-top text-muted-foreground">
                    <p className="line-clamp-2">{review.summary}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={
                        review.status === "published"
                          ? "inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                          : "inline-flex items-center rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
                      }
                    >
                      {t(`status.${review.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                    {new Date(review.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {review.status === "published" ? (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/fromhere/reviews/${review.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />
                            {t("openPublic")}
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/fromhere/admin/reviews/${review.id}/edit`}>
                          <Edit3 className="mr-1 h-3.5 w-3.5" aria-hidden />
                          {t("edit")}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingId === review.id}
                        onClick={() => void handleDelete(review.id)}
                        className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {deletingId === review.id ? t("deleting") : t("delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
