"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ImageIcon, Loader2, Tag as TagIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"

import type { ProductEditInitialValues } from "@/fromhere/_product-edit-data"
import { updateFromHereProductContentAction } from "@/fromhere/_product-actions"
import {
  FROMHERE_CATEGORIES,
  FROMHERE_DESCRIPTION_MAX,
  FROMHERE_TAG_MAX_COUNT,
  FROMHERE_TAG_MAX_LENGTH,
  FROMHERE_TAGLINE_MAX,
  FROMHERE_TITLE_MAX,
  getFromHereJstTomorrowDateString,
  isFromHereBlockedScheduledDate,
  isSafeProductUrl,
  parseFromHereScheduledDateToUtcIso,
  validateFromHereProductDraft,
  type FromHereCategory,
} from "@/fromhere/_product-validation"

/** プロダクト編集ページ（テキスト系のみ）。
 *
 * セキュリティ方針:
 * - 認証 + 所有者検証は SSR 側 (`fetchFromHereProductForEdit`) で済んでいる前提。
 * - 本コンポーネントは初期値を props で受け取り、PATCH `/api/fromhere/products/[id]` の
 *   `{ content }` ペイロードで内容を更新する。
 * - クライアント検証は UX のみ。サーバ側 (`validateFromHereProductDraft`) で再検証される。
 * - 画像差し替えは本フェーズではサポートしない（プレビュー表示のみ）。
 */
type Props = {
  product: ProductEditInitialValues
}

export function EditProductPageClient({ product }: Props) {
  const router = useRouter()
  const t = useTranslations("fromhere.productEdit")
  const tErr = useTranslations("fromhere.productEdit.errors")
  const tCat = useTranslations("fromhere.filters")

  const [title, setTitle] = useState(product.title)
  const [tagline, setTagline] = useState(product.tagline)
  const [description, setDescription] = useState(product.description)
  const [category, setCategory] = useState<FromHereCategory>(product.category)
  const [tags, setTags] = useState<string[]>(product.tags)
  const [tagInput, setTagInput] = useState("")
  const [productUrl, setProductUrl] = useState(product.productUrl)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  /**
   * 公開予定日 (JST, YYYY-MM-DD) の編集 UI 用 state。
   *
   * - SSR で取得した `postedAtIso` を JST 換算して初期値にする。
   * - `posted_at > now()` (= 未公開予約) のときのみ編集 UI を表示する。
   * - 既に公開済みのプロダクトでは UI 自体を表示しない（サーバー側でも防御）。
   * - フォーム送信時は「初期値から変わっている」ときのみ payload に含める。
   */
  const initialScheduledDate = useMemo(
    () => toJstDateString(product.postedAtIso),
    [product.postedAtIso],
  )
  const [scheduledDate, setScheduledDate] = useState<string>(initialScheduledDate)
  /** 公開予定日が未来か（= 未公開予約状態か）。SSR と CSR でぶれないよう mount 後に判定する。 */
  const [canEditSchedule, setCanEditSchedule] = useState(false)
  /** `<input type="date" min="...">` の最小値は「ページを開いた瞬間の JST 翌日」。 */
  const minScheduledDate = useMemo(() => getFromHereJstTomorrowDateString(), [])

  /**
   * SSR ハイドレーション直後に、現在時刻と `postedAtIso` を比較して編集可否を判定する。
   *
   * - `Date.now()` を使うため SSR で計算するとサーバー / クライアントで値がずれる。
   *   そのため SSR 初期値は false で、effect でクライアント側のみセットする。
   * - `set-state-in-effect`: 「現在時刻」という外部状態を React state に反映するため、
   *   effect 内 setState が必要。同条件で 1 度だけ走るので無限ループの懸念はない。
   */
  useEffect(() => {
    if (!product.postedAtIso) return
    const ms = new Date(product.postedAtIso).getTime()
    if (Number.isFinite(ms) && ms > Date.now()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 現在時刻に依存する初期判定
      setCanEditSchedule(true)
    }
  }, [product.postedAtIso])

  const scheduledDateChanged = scheduledDate !== initialScheduledDate
  const scheduledDateValidation = useMemo(() => {
    if (!canEditSchedule || !scheduledDateChanged) {
      return { ok: true as const }
    }
    return parseFromHereScheduledDateToUtcIso(scheduledDate)
  }, [canEditSchedule, scheduledDateChanged, scheduledDate])

  const handleAddTag = () => {
    const v = tagInput.trim()
    if (!v) {
      return
    }
    if (tags.length >= FROMHERE_TAG_MAX_COUNT) {
      setNotice({
        variant: "error",
        message: tErr("tags", { max: FROMHERE_TAG_MAX_COUNT, len: FROMHERE_TAG_MAX_LENGTH }),
      })
      return
    }
    if (v.length > FROMHERE_TAG_MAX_LENGTH) {
      setNotice({
        variant: "error",
        message: tErr("tags", { max: FROMHERE_TAG_MAX_COUNT, len: FROMHERE_TAG_MAX_LENGTH }),
      })
      return
    }
    if (!/^[\p{L}\p{N} _\-.]+$/u.test(v)) {
      setNotice({ variant: "error", message: tErr("tagsCharset") })
      return
    }
    const lower = v.toLowerCase()
    if (tags.some((existing) => existing.toLowerCase() === lower)) {
      setTagInput("")
      return
    }
    setTags([...tags, v])
    setTagInput("")
  }

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const localValidation = useMemo(() => {
    return validateFromHereProductDraft({
      title,
      tagline,
      description,
      category,
      tags,
      productUrl,
      // 画像 path は SSR から取得した値をそのまま検証用に渡す（変更はしない）。
      appIconPath: product.appIconPath,
      screenshotPath: product.screenshotPath,
    })
  }, [
    title,
    tagline,
    description,
    category,
    tags,
    productUrl,
    product.appIconPath,
    product.screenshotPath,
  ])

  const canSubmit =
    !isSubmitting && localValidation.ok && isSafeProductUrl(productUrl) && scheduledDateValidation.ok

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    if (!canSubmit || !localValidation.ok) {
      return
    }
    setIsSubmitting(true)
    try {
      const result = await updateFromHereProductContentAction({
        productId: product.id,
        content: {
          title: localValidation.value.title,
          tagline: localValidation.value.tagline,
          description: localValidation.value.description ?? "",
          category: localValidation.value.category,
          tags: localValidation.value.tags,
          productUrl: localValidation.value.productUrl,
          /**
           * 公開予定日は「未公開予約のプロダクトかつ初期値から変わっているとき」のみ送る。
           * 既存値と同じなら undefined のまま送ってサーバー側の posted_at 更新を抑制する。
           */
          scheduledDate:
            canEditSchedule && scheduledDateChanged ? scheduledDate : undefined,
        },
      })

      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/products content] action failed", {
            productId: product.id,
            errorKey: result.error,
          })
        }
        if (result.error === "unauthorized") {
          setNotice({ variant: "error", message: t("loginRequired") })
          router.replace("/fromhere/signin")
          return
        }
        const message = resolveServerErrorMessage(result.error, tErr)
        if (result.error === "forbidden") {
          setNotice({ variant: "error", message })
          router.replace("/fromhere")
          return
        }
        setNotice({ variant: "error", message })
        return
      }

      setNotice(toSuccessNotice(t("successToast")))
      /**
       * 編集後は商品詳細にリダイレクト。Server Action 内で `revalidatePath` を
       * 呼んでいるため Data Cache は最新だが、Client Router Cache も `router.refresh()`
       * で確実に invalidate して、編集内容が確実に詳細ページに反映されるようにする。
       */
      router.replace(`/fromhere/p/${product.slug}`)
      router.refresh()
    } catch (error) {
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/fromhere/p/${product.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {product.title}
        </Link>
      </div>

      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t("heading")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {(product.appIconUrl || product.screenshotUrl) && (
        <Card className="mb-6 border-border bg-card/50">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {product.appIconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 公開 URL の表示
                <img
                  src={product.appIconUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{product.title}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">{t("titleLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_title">
                {t("titleLabel")}
              </label>
              <Input
                id="fh_edit_title"
                value={title}
                onChange={(event) => setTitle(event.target.value.slice(0, FROMHERE_TITLE_MAX))}
                maxLength={FROMHERE_TITLE_MAX}
                className="border-input bg-background"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("titleHelp")}</span>
                <span>
                  {title.length} / {FROMHERE_TITLE_MAX}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_tagline">
                {t("taglineLabel")}
              </label>
              <Input
                id="fh_edit_tagline"
                value={tagline}
                onChange={(event) => setTagline(event.target.value.slice(0, FROMHERE_TAGLINE_MAX))}
                maxLength={FROMHERE_TAGLINE_MAX}
                className="border-input bg-background"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("taglineHelp")}</span>
                <span>
                  {tagline.length} / {FROMHERE_TAGLINE_MAX}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_category">
                {t("categoryLabel")}
              </label>
              <select
                id="fh_edit_category"
                value={category}
                onChange={(event) => setCategory(event.target.value as FromHereCategory)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {FROMHERE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tCat(`category${capitalize(c)}`)}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">{t("descriptionLabel")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_description">
                {t("descriptionLabel")}
              </label>
              <textarea
                id="fh_edit_description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, FROMHERE_DESCRIPTION_MAX))
                }
                maxLength={FROMHERE_DESCRIPTION_MAX}
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("descriptionHelp", { max: FROMHERE_DESCRIPTION_MAX })}</span>
                <span>
                  {description.length} / {FROMHERE_DESCRIPTION_MAX}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_tags">
                {t("tagsLabel")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="fh_edit_tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value.slice(0, FROMHERE_TAG_MAX_LENGTH))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleAddTag()
                    }
                  }}
                  placeholder={t("tagsPlaceholder")}
                  maxLength={FROMHERE_TAG_MAX_LENGTH}
                  className="border-input bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || tags.length >= FROMHERE_TAG_MAX_COUNT}
                >
                  {t("tagsAddAction")}
                </Button>
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                    >
                      <TagIcon className="h-3 w-3 text-muted-foreground" aria-hidden />
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        aria-label={t("tagsRemove")}
                        className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {t("tagsHelp", { max: FROMHERE_TAG_MAX_COUNT })}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fh_edit_url">
                {t("productUrlLabel")}
              </label>
              <Input
                id="fh_edit_url"
                type="url"
                inputMode="url"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                maxLength={2048}
                className="border-input bg-background"
              />
              {productUrl.length > 0 && !isSafeProductUrl(productUrl) ? (
                <p className="text-xs text-red-500">{tErr("productUrl")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("productUrlHelp")}</p>
              )}
            </div>

            {/**
             * 公開予定日 (JST) の編集 UI。
             * - 未公開予約 (`posted_at > now()`) のプロダクトのみ表示する。
             * - 既に公開済みのものを変更すると一覧体験が崩れるため、サーバー側でも防御。
             */}
            {canEditSchedule ? (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="fh_edit_scheduled_date"
                >
                  {t("scheduledDateLabel")}
                </label>
                <Input
                  id="fh_edit_scheduled_date"
                  type="date"
                  value={scheduledDate}
                  min={minScheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="border-input bg-background"
                />
                {scheduledDateValidation.ok ? (
                  <p className="text-xs text-muted-foreground">{t("scheduledDateHelp")}</p>
                ) : (
                  /**
                   * 「翌日以降か」「フォーマット不正か」「運営側で禁止された日付か」を区別。
                   * `isFromHereBlockedScheduledDate` は文字列比較なので不正入力でも安全。
                   */
                  <p className="text-xs text-red-500">
                    {isFromHereBlockedScheduledDate(scheduledDate)
                      ? tErr("scheduledDateBlocked")
                      : tErr("scheduledDate")}
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            href={`/fromhere/p/${product.slug}`}
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("cancel")}
          </Link>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-11 bg-primary px-6 text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}

/**
 * UTC ISO 文字列を JST の `YYYY-MM-DD` に変換する。
 *
 * `posted_at` には「JST 00:00 を UTC に直した時刻」が入っているため、
 * `+9 時間` してから `YYYY-MM-DD` を取り出すと元の JST 日付に戻る。
 * 不正な ISO 文字列のときは空文字列を返し、`<input type="date">` の
 * 初期値を空にしてユーザーが選び直せる状態にする。
 */
function toJstDateString(isoUtc: string | null): string {
  if (!isoUtc) return ""
  const ms = new Date(isoUtc).getTime()
  if (!Number.isFinite(ms)) return ""
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function resolveServerErrorMessage(
  key: string,
  tErr: ReturnType<typeof useTranslations>,
): string {
  switch (key) {
    case "title":
      return tErr("title", { max: FROMHERE_TITLE_MAX })
    case "tagline":
      return tErr("tagline", { max: FROMHERE_TAGLINE_MAX })
    case "description":
      return tErr("description", { max: FROMHERE_DESCRIPTION_MAX })
    case "category":
      return tErr("category")
    case "tags":
      return tErr("tags", { max: FROMHERE_TAG_MAX_COUNT, len: FROMHERE_TAG_MAX_LENGTH })
    case "tagsCharset":
      return tErr("tagsCharset")
    case "productUrl":
      return tErr("productUrl")
    case "productUrlScheme":
      return tErr("productUrlScheme")
    case "scheduledDate":
      return tErr("scheduledDate")
    case "schedule_locked":
      return tErr("scheduleLocked")
    case "rate_limited":
      return tErr("rateLimited")
    case "forbidden":
      return tErr("forbidden")
    case "not_found":
      return tErr("notFound")
    default:
      return tErr("saveFailed")
  }
}
