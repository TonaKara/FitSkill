"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { ExternalLink, Loader2, Pencil, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { formatSkillCategoryDisplay } from "@/lib/skill-categories"
import { SkillThumbnailSurface } from "@/components/skill-thumbnail-surface"
import {
  fetchStoreListings,
  filterStoreListings,
  type StoreListing,
  type StoreListingFilter,
} from "@/lib/store-listings"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { resolveSkillThumbnailUrl, skillThumbnailContainerAspectStyle } from "@/lib/skill-thumbnail"

type MyStoreListingsPanelProps = {
  userId: string
  onNotice: (notice: AppNotice) => void
  onListingsChanged?: () => void
}

const FILTER_OPTIONS: { id: StoreListingFilter; label: string }[] = [
  { id: "published", label: "公開中" },
  { id: "draft", label: "下書き・非公開" },
  { id: "all", label: "すべて" },
]

function ListingStatusBadges({ skill }: { skill: StoreListing }) {
  return (
    <>
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          skill.is_published === false
            ? "bg-muted text-muted-foreground"
            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {skill.is_published === false ? "非公開" : "公開中"}
      </span>
      {skill.admin_publish_locked ? (
        <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-200">
          運営により非公開
        </span>
      ) : null}
    </>
  )
}

export function MyStoreListingsPanel({ userId, onNotice, onListingsChanged }: MyStoreListingsPanelProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [listings, setListings] = useState<StoreListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StoreListingFilter>("published")
  const [publishingListingId, setPublishingListingId] = useState<string | null>(null)
  const [publishConfirmId, setPublishConfirmId] = useState<string | null>(null)
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const loadListings = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchStoreListings(supabase, userId)
    setListings(result.listings)
    setError(result.error)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    void loadListings()
  }, [loadListings])

  const filteredListings = useMemo(() => filterStoreListings(listings, filter), [listings, filter])

  const publishTarget = publishConfirmId ? listings.find((item) => item.id === publishConfirmId) : null

  const executePublish = async () => {
    const skillId = publishConfirmId
    if (!skillId || publishingListingId) {
      return
    }
    const target = listings.find((item) => item.id === skillId)
    if (target?.admin_publish_locked) {
      setPublishConfirmId(null)
      onNotice({
        variant: "error",
        message: "運営による非公開のため、ご自身で公開に戻すことはできません。",
      })
      return
    }

    setPublishingListingId(skillId)
    const { error: publishError } = await supabase
      .from("skills")
      .update({ is_published: true })
      .eq("id", skillId)
      .eq("user_id", userId)

    setPublishingListingId(null)
    setPublishConfirmId(null)

    if (publishError) {
      onNotice(toErrorNotice(publishError, false, { unknownErrorMessage: "商品の公開に失敗しました。" }))
      return
    }

    setListings((prev) => prev.map((item) => (item.id === skillId ? { ...item, is_published: true } : item)))
    onNotice({ variant: "success", message: "商品を公開しました。" })
    onListingsChanged?.()
  }

  return (
    <section id="store-listings" className="min-w-0 scroll-mt-24 rounded-2xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-foreground">出品中の商品</h3>
        </div>
        <Button asChild size="sm" className="shrink-0 bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
          <Link href="/create-skill">
            <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
            新規出品
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 sm:px-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" aria-hidden />
            読み込み中...
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : filteredListings.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs font-normal text-neutral-400 dark:text-muted-foreground">
              {filter === "published"
                ? "公開中の商品はまだありません。"
                : filter === "draft"
                  ? "下書き・非公開の商品はありません。"
                  : "まだ出品した商品がありません。"}
            </p>
            <Button asChild className="mt-4 bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
              <Link href="/create-skill">最初の商品を出品する</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredListings.map((skill) => (
              <li
                key={skill.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                  <div
                    className="relative w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:w-14"
                    style={skillThumbnailContainerAspectStyle()}
                    role="img"
                    aria-label={`${skill.title}のサムネイル`}
                  >
                    <SkillThumbnailSurface imageUrl={resolveSkillThumbnailUrl(skill.thumbnail_url)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{skill.title}</p>
                      <ListingStatusBadges skill={skill} />
                    </div>
                    <p className="mt-1 text-xs font-normal text-neutral-400 dark:text-muted-foreground">
                      {skill.category ? formatSkillCategoryDisplay(skill.category) : "未分類"} ·{" "}
                      {Number(skill.price).toLocaleString("ja-JP")}円
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {skill.is_published === true ? (
                    <Button asChild variant="outline" size="sm" className="border-border">
                      <Link href={`/skills/${encodeURIComponent(skill.id)}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        表示
                      </Link>
                    </Button>
                  ) : null}
                  {skill.is_published === false && !skill.admin_publish_locked ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={publishingListingId === skill.id}
                      onClick={() => setPublishConfirmId(skill.id)}
                      className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {publishingListingId === skill.id ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                          公開中...
                        </>
                      ) : (
                        "公開する"
                      )}
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm" className="border-border">
                    <Link href={`/create-skill?edit=${encodeURIComponent(skill.id)}`}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      編集
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>

      {portalReady && publishConfirmId && publishTarget
        ? createPortal(
            <div
              className="fixed inset-0 z-[10000] flex min-h-[100dvh] items-center justify-center bg-black/60 p-4"
              role="presentation"
              onClick={() => {
                if (!publishingListingId) {
                  setPublishConfirmId(null)
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="store-listing-publish-title"
                className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="store-listing-publish-title" className="text-center text-base font-semibold text-foreground">
                  この商品を公開しますか？
                </h2>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  「{publishTarget.title}」をストアに表示する状態になります。
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-border"
                    disabled={Boolean(publishingListingId)}
                    onClick={() => setPublishConfirmId(null)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-emerald-600 font-semibold text-white hover:bg-emerald-500"
                    disabled={Boolean(publishingListingId)}
                    onClick={() => void executePublish()}
                  >
                    {publishingListingId ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        公開中...
                      </>
                    ) : (
                      "公開する"
                    )}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
