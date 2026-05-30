"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Image as ImageIcon,
  Loader2,
  Plus,
  Tag as TagIcon,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import { FROMHERE_COMMENT_MAX_LENGTH } from "@/fromhere/_comment-validation"
import { createFromHereProductAction } from "@/fromhere/_product-actions"
import {
  FROMHERE_ALLOWED_IMAGE_MIME,
  FROMHERE_APP_ICON_MAX_BYTES,
  FROMHERE_CATEGORIES,
  FROMHERE_DESCRIPTION_MAX,
  FROMHERE_SCREENSHOT_MAX_BYTES,
  FROMHERE_SUGGESTED_TAGS,
  FROMHERE_TAG_MAX_COUNT,
  FROMHERE_TAG_MAX_LENGTH,
  FROMHERE_TAGLINE_MAX,
  FROMHERE_TITLE_MAX,
  containsFromHereDescriptionHtml,
  getFromHereJstTomorrowDateString,
  isAllowedImageMime,
  isFromHereBlockedScheduledDate,
  isFromHereCategory,
  isFromHereTagCharsAllowed,
  isSafeProductUrl,
  parseFromHereScheduledDateToUtcIso,
  validateFromHereProductDraft,
  type FromHereCategory,
} from "@/fromhere/_product-validation"
import {
  removeFromHereImage,
  uploadFromHereImage,
  type FromHereUploadKind,
} from "@/fromhere/_upload"

type UploadState =
  | { state: "empty" }
  | { state: "uploading" }
  | { state: "done"; path: string; publicUrl: string; previewUrl: string }
  | { state: "error" }

/**
 * 投稿フォームの下書きを保持するための localStorage キー。
 *
 * - リロード時のみ自動復元する用途。ナビゲーションで離脱したときは確認モーダルで
 *   破棄する前提のため、TTL は設けず最新の入力で常に上書きする。
 * - スキーマ変更時はバージョン番号 (`:v1`) を上げて旧形式の復元を防ぐ。
 */
const SUBMIT_DRAFT_STORAGE_KEY = "fromhere:submit:draft:v3"

type StoredDraft = {
  title: string
  tagline: string
  description: string
  category: FromHereCategory
  tags: string[]
  productUrl: string
  appIcon: { path: string; publicUrl: string } | null
  screenshot: { path: string; publicUrl: string } | null
  /** YYYY-MM-DD (JST)。未指定なら復元しない（毎回「翌日」が初期値）。 */
  scheduledDate?: string
  /** メーカー本人による最初のコメント（任意） */
  firstComment?: string
}

/** プロダクト投稿ページ。
 *
 * セキュリティ方針:
 * - 認証必須 + プロフィール作成済みであることを最初に確認。未満たしならリダイレクト。
 * - クライアント検証はあくまで UX。最終的に `/api/fromhere/products` と DB CHECK / RLS で
 *   再検証される。
 * - 画像は `_upload.ts` 経由で Storage 直接アップロード。バケット設定で MIME / サイズが
 *   ハードガードされている。送信時に API が path の所有権を確認する。
 */
export default function FromHereSubmitPage() {
  const router = useRouter()
  const t = useTranslations("fromhere.submit")
  const tCat = useTranslations("fromhere.filters")
  const tErr = useTranslations("fromhere.submit.errors")

  const { user, profile, loading: authLoading } = useFromHereAuth()

  const [title, setTitle] = useState("")
  const [tagline, setTagline] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<FromHereCategory>("other")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [productUrl, setProductUrl] = useState("")
  const [appIcon, setAppIcon] = useState<UploadState>({ state: "empty" })
  const [screenshot, setScreenshot] = useState<UploadState>({ state: "empty" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  /**
   * 公開日（JST）の YYYY-MM-DD 文字列。
   * 初期値は「投稿時点の JST 翌日」。`<input type="date" min="...">` の最小値も同じ。
   * SSR と CSR でずれが出ないように、初期化は遅延評価で 1 度だけ行う。
   */
  const [scheduledDate, setScheduledDate] = useState<string>(() =>
    getFromHereJstTomorrowDateString(),
  )
  /**
   * メーカー本人による「最初のコメント」(任意)。
   * - 公開と同時に通常のコメントとして表示される。
   * - サーバー側で `posted_at` と同じ時刻を `created_at` に揃えて保存する。
   */
  const [firstComment, setFirstComment] = useState<string>("")
  /**
   * `<input type="date">` の min は「ページを開いた瞬間の JST 翌日」を入れる。
   * 日付をまたいで滞在し続けても、サーバー側で必ず最終検証を行う（クライアントの min はあくまで UX）。
   */
  const minScheduledDate = useMemo(() => getFromHereJstTomorrowDateString(), [])
  const redirectedRef = useRef(false)

  /**
   * 離脱確認モーダル。
   *
   * - `target` が null のときはブラウザの「戻る」操作を検知して開いた状態。OK 時は
   *   `window.history.go(-2)` でダミー履歴と元の履歴を一気に戻す。
   * - `target` に文字列が入っているとき (= ページ内リンクからの離脱) は OK 時にその
   *   パスへ `router.push` で遷移する。
   */
  const [leaveModal, setLeaveModal] = useState<{ open: boolean; target: string | null }>({
    open: false,
    target: null,
  })
  /** 離脱処理中フラグ。重複した popstate ハンドリングや cleanup を抑止するために使う。 */
  const leavingRef = useRef(false)
  /** localStorage からの復元が完了したかどうか。完了前は永続化処理を走らせない。 */
  const restoredRef = useRef(false)

  /**
   * 認証ガード（Client 側）。
   *
   * 認証 + プロフィール作成済みの判定は **SSR (`app/fromhere/submit/page.tsx`)** で
   * 既に済んでいる。クライアント側では、ページ滞在中にセッションが切れた場合のみ
   * サインインへリダイレクトする保険として機能させる。
   * （SSR で profile が確認されているので、profile === null での onboarding 自動
   * リダイレクトは行わない — `useFromHereAuth` の `profile` は `onAuthStateChange` 直後
   * に一時的に null になり得るため、誤って onboarding に飛ばすのを避ける。）
   */
  useEffect(() => {
    if (authLoading || redirectedRef.current) {
      return
    }
    if (!user) {
      redirectedRef.current = true
      router.replace("/fromhere/signin")
    }
  }, [authLoading, user, router])

  /**
   * ページ離脱時、未送信のアップロード済み画像があれば Storage から消す。
   *
   * - 投稿成功 (`isSubmitting → true` のまま遷移) や、確認モーダル経由の明示的な
   *   破棄 (`leavingRef.current === true`) のときは、明示側で削除済みのため skip する。
   * - ブラウザ自体のリロードでは React の cleanup は走らない想定。下書きは
   *   localStorage に保存しているので、画像も Storage 上に残ったまま復元できる。
   */
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (appIcon.state === "done") {
          await removeFromHereImage("app_icon", appIcon.path)
        }
        if (screenshot.state === "done") {
          await removeFromHereImage("screenshot", screenshot.path)
        }
      }
      if (!isSubmitting && !leavingRef.current) {
        void cleanup()
      }
    }
    // 依存の追加でアンマウント以外も発火しないよう、空依存で一度だけ登録する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * マウント時に localStorage から下書きを復元する。
   *
   * - 画像は object URL ではなく Storage の公開 URL を `previewUrl` に流用する。
   *   `URL.revokeObjectURL` は通常 URL に対して呼んでも害がないため、削除時の
   *   既存ロジックを変更せずに済む。
   * - 不正な JSON や不明なカテゴリは無視して既定値で起動する。
   * - SSR 時とクライアント初回レンダリングは空の既定値で揃え、ハイドレーション後に
   *   setState で復元するためハイドレーション不一致を避けられる。useEffect 内で
   *   setState を呼ぶ必要があるため、外部状態 → React への同期として例外的に許可。
   */
  /* eslint-disable react-hooks/set-state-in-effect -- localStorage という外部状態から React state を初期化するため、effect 内 setState が必要 */
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SUBMIT_DRAFT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<StoredDraft>
      if (typeof parsed.title === "string") setTitle(parsed.title.slice(0, FROMHERE_TITLE_MAX))
      if (typeof parsed.tagline === "string") setTagline(parsed.tagline.slice(0, FROMHERE_TAGLINE_MAX))
      if (typeof parsed.description === "string") {
        setDescription(parsed.description.slice(0, FROMHERE_DESCRIPTION_MAX))
      }
      if (typeof parsed.category === "string" && isFromHereCategory(parsed.category)) {
        setCategory(parsed.category)
      }
      if (Array.isArray(parsed.tags)) {
        setTags(
          parsed.tags
            .filter((tag): tag is string => typeof tag === "string")
            .slice(0, FROMHERE_TAG_MAX_COUNT)
            .map((tag) => tag.slice(0, FROMHERE_TAG_MAX_LENGTH)),
        )
      }
      if (typeof parsed.productUrl === "string") setProductUrl(parsed.productUrl)
      if (
        parsed.appIcon &&
        typeof parsed.appIcon.path === "string" &&
        typeof parsed.appIcon.publicUrl === "string"
      ) {
        setAppIcon({
          state: "done",
          path: parsed.appIcon.path,
          publicUrl: parsed.appIcon.publicUrl,
          previewUrl: parsed.appIcon.publicUrl,
        })
      }
      if (
        parsed.screenshot &&
        typeof parsed.screenshot.path === "string" &&
        typeof parsed.screenshot.publicUrl === "string"
      ) {
        setScreenshot({
          state: "done",
          path: parsed.screenshot.path,
          publicUrl: parsed.screenshot.publicUrl,
          previewUrl: parsed.screenshot.publicUrl,
        })
      }
      /**
       * 公開日の復元:
       * - 保存値が「現在の JST 翌日」以降なら採用。
       * - 古くなって過去日になっていたら破棄して初期値（翌日）を使う。
       */
      if (typeof parsed.scheduledDate === "string") {
        const tomorrow = getFromHereJstTomorrowDateString()
        if (parsed.scheduledDate >= tomorrow) {
          setScheduledDate(parsed.scheduledDate)
        }
      }
      if (typeof parsed.firstComment === "string") {
        setFirstComment(parsed.firstComment.slice(0, FROMHERE_COMMENT_MAX_LENGTH))
      }
    } catch {
      // 破損した下書きは無視。書き直しで上書きされる。
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * フォーム入力が変わるたびに localStorage に書き戻す。
   *
   * - 復元前は何もしない（既定値で上書きされるのを防ぐ）。
   * - 画像は `done` 状態のときのみ、Storage 上の path/publicUrl を保持する。
   */
  useEffect(() => {
    if (!restoredRef.current) return
    if (typeof window === "undefined") return
    try {
      const payload: StoredDraft = {
        title,
        tagline,
        description,
        category,
        tags,
        productUrl,
        appIcon:
          appIcon.state === "done"
            ? { path: appIcon.path, publicUrl: appIcon.publicUrl }
            : null,
        screenshot:
          screenshot.state === "done"
            ? { path: screenshot.path, publicUrl: screenshot.publicUrl }
            : null,
        scheduledDate,
        firstComment,
      }
      window.localStorage.setItem(SUBMIT_DRAFT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // 容量オーバー等は無視。最悪、復元できないだけで送信には影響しない。
    }
  }, [
    title,
    tagline,
    description,
    category,
    tags,
    productUrl,
    appIcon,
    screenshot,
    scheduledDate,
    firstComment,
  ])

  /**
   * 戻るボタン (popstate) を検知して離脱確認モーダルを出す。
   *
   * - マウント時にダミー履歴を 1 つ積み、戻るを押された時に popstate を発火させる。
   * - 確認モーダルで「破棄して戻る」を選んだら `window.history.go(-2)` でダミーと
   *   元の履歴の両方を戻す。
   * - リロード・タブ閉じは対象外（localStorage で下書きを保持）。
   */
  useEffect(() => {
    if (typeof window === "undefined") return
    window.history.pushState({ submitGuard: true }, "", window.location.href)
    const onPopState = () => {
      if (leavingRef.current) return
      window.history.pushState({ submitGuard: true }, "", window.location.href)
      setLeaveModal({ open: true, target: null })
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  /**
   * ページ内のあらゆる `<a>` クリック (= ヘッダーのロゴ、サイドメニュー、フッター等)
   * を document-level の capture フェーズで横取りして離脱確認モーダルを出す。
   *
   * App Router (Next.js 16) には公式の navigation guard API がないため、
   * クリックイベントを capture フェーズで掴むしか方法がない。`Link` (`next/link`)
   * は最終的に `<a>` を出力するので、これで十分カバーできる。
   *
   * スキップ条件 (= ネイティブ動作を維持):
   *   - 修飾キー押下 (Cmd/Ctrl/Shift/Alt) / 右クリック・中クリック
   *   - `target="_blank"` などの新規タブ遷移
   *   - `download` 属性付き
   *   - `mailto:` / `tel:` / `javascript:` / アンカーのみ (`#xxx`)
   *   - 同一パス + 同一クエリ (ハッシュ内移動など)
   *   - 別オリジン
   *   - `data-bypass-leave-guard` 属性が付いたリンク (= 後述の cancel ボタン等)
   *
   * `leavingRef.current === true` のとき (= 確認モーダル経由で離脱処理中) は素通し。
   */
  useEffect(() => {
    if (typeof window === "undefined") return

    function onDocClick(event: MouseEvent) {
      if (leavingRef.current) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest("a[href]") as HTMLAnchorElement | null
      if (!link) return

      /**
       * フォーム内のクリックには関与しない。
       *
       * - 投稿ボタン (`<button type="submit">`) は `<a>` ではないので元々 intercept
       *   されないが、念のためフォーム内の `<a>` (= プレビュー内の外部リンクや
       *   `← FromHere` リンク) も捌かない方針にして、フォーム送信などの React 側
       *   イベント処理と完全に独立させる。
       * - `← FromHere` リンクは既に `onClick + requestLeaveTo` で確認モーダルを
       *   出すように実装されているため、ここでスキップしても挙動は変わらない。
       */
      if (link.closest("form")) return

      // 明示的にスキップ指定されたリンク
      if (link.dataset.bypassLeaveGuard === "true") return
      // 別タブ / ダウンロード等のネイティブ動作はそのまま
      if (link.target && link.target !== "_self") return
      if (link.hasAttribute("download")) return

      const rawHref = link.getAttribute("href") || ""
      if (!rawHref) return
      if (rawHref.startsWith("#")) return
      if (rawHref.startsWith("mailto:")) return
      if (rawHref.startsWith("tel:")) return
      if (rawHref.startsWith("javascript:")) return

      let url: URL
      try {
        url = new URL(link.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return

      // 同一パス + 同一クエリならハッシュ移動などとみなしてスキップ
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setLeaveModal({ open: true, target: url.pathname + url.search + url.hash })
    }

    document.addEventListener("click", onDocClick, { capture: true })
    return () => {
      document.removeEventListener("click", onDocClick, { capture: true })
    }
  }, [])

  /** 破棄して離脱する処理。画像 Storage と localStorage を掃除してから遷移する */
  const confirmLeave = async () => {
    if (leavingRef.current) return
    leavingRef.current = true
    const target = leaveModal.target
    setLeaveModal({ open: false, target: null })
    redirectedRef.current = true
    try {
      if (appIcon.state === "done") {
        await removeFromHereImage("app_icon", appIcon.path)
      }
      if (screenshot.state === "done") {
        await removeFromHereImage("screenshot", screenshot.path)
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SUBMIT_DRAFT_STORAGE_KEY)
      }
    } catch {
      // 失敗しても遷移は継続する
    }
    if (target) {
      router.push(target)
    } else if (typeof window !== "undefined") {
      // ダミー履歴 + 本来の前ページの 2 つ分を一気に戻る
      window.history.go(-2)
    }
  }

  const cancelLeave = () => {
    setLeaveModal({ open: false, target: null })
  }

  /** 投稿フォーム内のリンクから離脱する際に確認モーダルを噛ませる */
  const requestLeaveTo = (href: string) => {
    setLeaveModal({ open: true, target: href })
  }

  /**
   * タグを追加する。
   *
   * - `overrideValue` が渡された場合（推奨タグチップから呼ばれる場合）はその値を使用し、
   *   未指定なら現在の自由入力テキスト (`tagInput`) を使う。
   * - 上限件数 / 1 タグの文字数 / 許可文字種別を満たさなければ通知を出して中止。
   * - 大文字小文字を無視した重複は黙って無視する（チップ連打しても増えない）。
   */
  const handleAddTag = (overrideValue?: string) => {
    const v = (overrideValue ?? tagInput).trim()
    if (!v) {
      return
    }
    if (tags.length >= FROMHERE_TAG_MAX_COUNT) {
      setNotice({ variant: "error", message: tErr("tags") })
      return
    }
    if (v.length > FROMHERE_TAG_MAX_LENGTH) {
      setNotice({ variant: "error", message: tErr("tags") })
      return
    }
    if (!/^[\p{L}\p{N} _\-.]+$/u.test(v)) {
      setNotice({ variant: "error", message: tErr("tagsCharset") })
      return
    }
    const lower = v.toLowerCase()
    if (tags.some((existing) => existing.toLowerCase() === lower)) {
      if (overrideValue === undefined) {
        setTagInput("")
      }
      return
    }
    setTags([...tags, v])
    if (overrideValue === undefined) {
      setTagInput("")
    }
  }

  const handleRemoveTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index))
  }

  const handleFileSelect = async (kind: FromHereUploadKind, file: File | null) => {
    if (!file) {
      return
    }
    if (!isAllowedImageMime(file.type)) {
      setNotice({
        variant: "error",
        message: kind === "app_icon" ? tErr("appIconType") : tErr("screenshotType"),
      })
      return
    }
    const maxBytes = kind === "app_icon" ? FROMHERE_APP_ICON_MAX_BYTES : FROMHERE_SCREENSHOT_MAX_BYTES
    if (file.size > maxBytes) {
      setNotice({
        variant: "error",
        message: kind === "app_icon" ? tErr("appIconSize") : tErr("screenshotSize"),
      })
      return
    }

    const previous = kind === "app_icon" ? appIcon : screenshot
    const setter = kind === "app_icon" ? setAppIcon : setScreenshot

    setter({ state: "uploading" })
    const result = await uploadFromHereImage(kind, file)
    if (!result.ok) {
      setter({ state: "error" })
      if (result.reason === "type") {
        setNotice({
          variant: "error",
          message: kind === "app_icon" ? tErr("appIconType") : tErr("screenshotType"),
        })
      } else if (result.reason === "size") {
        setNotice({
          variant: "error",
          message: kind === "app_icon" ? tErr("appIconSize") : tErr("screenshotSize"),
        })
      } else if (result.reason === "auth") {
        setNotice({ variant: "error", message: tErr("sessionExpired") })
      } else {
        setNotice({ variant: "error", message: tErr("uploadFailed") })
      }
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setter({ state: "done", path: result.path, publicUrl: result.publicUrl, previewUrl })

    // 差し替えた場合は旧オブジェクトをクリーンアップ
    if (previous.state === "done") {
      await removeFromHereImage(kind, previous.path)
      URL.revokeObjectURL(previous.previewUrl)
    }
  }

  const handleRemoveUploaded = async (kind: FromHereUploadKind) => {
    const current = kind === "app_icon" ? appIcon : screenshot
    const setter = kind === "app_icon" ? setAppIcon : setScreenshot
    if (current.state === "done") {
      await removeFromHereImage(kind, current.path)
      URL.revokeObjectURL(current.previewUrl)
    }
    setter({ state: "empty" })
  }

  const localValidation = useMemo(() => {
    return validateFromHereProductDraft(
      {
        title,
        tagline,
        description,
        category,
        tags,
        productUrl,
        appIconPath: appIcon.state === "done" ? appIcon.path : null,
        screenshotPath: screenshot.state === "done" ? screenshot.path : null,
      },
      // 新規投稿時はアプリアイコンを必須にする（サーバ側でも同じく検証される）
      { requireAppIcon: true },
    )
  }, [title, tagline, description, category, tags, productUrl, appIcon, screenshot])

  const isUploading = appIcon.state === "uploading" || screenshot.state === "uploading"

  /**
   * 公開日のローカル検証。
   * - 「翌日以降の YYYY-MM-DD」が入っているかを毎レンダー再評価する。
   * - サーバー側でも `parseFromHereScheduledDateToUtcIso` で同じ判定を行う。
   */
  const scheduledDateValidation = useMemo(
    () => parseFromHereScheduledDateToUtcIso(scheduledDate),
    [scheduledDate],
  )

  /**
   * 最初のコメントのローカル検証。
   * - 空文字なら「任意項目をスキップ」と見なして OK 扱い。
   * - 400 文字を超えた場合のみ NG にして送信を止める。HTML 混入などはサーバー側で
   *   最終確認するため、ここでは長さチェックのみで UX を軽くする。
   */
  const firstCommentTooLong = firstComment.trim().length > FROMHERE_COMMENT_MAX_LENGTH

  const canSubmit =
    !isSubmitting &&
    !isUploading &&
    localValidation.ok &&
    scheduledDateValidation.ok &&
    !firstCommentTooLong &&
    isSafeProductUrl(productUrl)

  /**
   * 投稿可否 (`canSubmit`) の現在値と、その内訳をコンソールに出力するデバッグ用ログ。
   *
   * 「投稿ボタンが押せない」「押しても何も起きない」原因の切り分けを容易にするため、
   * どの条件が false になっているかを表示する。production でも常に出すが、
   * info レベルなので通常時はノイズにならない。
   */
  useEffect(() => {
    if (typeof window === "undefined") return
    console.info("[fromhere/products create] canSubmit state", {
      canSubmit,
      reasons: {
        isSubmitting,
        isUploading,
        localValidationOk: localValidation.ok,
        localValidationError: localValidation.ok ? null : localValidation.error,
        scheduledDateOk: scheduledDateValidation.ok,
        scheduledDateInput: scheduledDate,
        firstCommentTooLong,
        productUrlIsSafe: isSafeProductUrl(productUrl),
      },
    })
  }, [
    canSubmit,
    isSubmitting,
    isUploading,
    localValidation,
    scheduledDateValidation,
    scheduledDate,
    firstCommentTooLong,
    productUrl,
  ])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)

    /**
     * デバッグ目的の事前ダンプ。
     * 投稿が始まらない / すぐに弾かれる場合に「どの条件で止まっているか」を
     * ブラウザコンソールから確認できるようにする。
     */
    if (typeof window !== "undefined") {
      console.info("[fromhere/products create] handleSubmit invoked", {
        canSubmit,
        isSubmitting,
        isUploading,
        localValidationOk: localValidation.ok,
        localValidationError: localValidation.ok ? null : localValidation.error,
        scheduledDateOk: scheduledDateValidation.ok,
        scheduledDateInput: scheduledDate,
        firstCommentTooLong,
        firstCommentLength: firstComment.trim().length,
        productUrl,
        productUrlIsSafe: isSafeProductUrl(productUrl),
        appIconState: appIcon.state,
        screenshotState: screenshot.state,
      })
    }

    if (!canSubmit || !localValidation.ok) {
      if (typeof window !== "undefined") {
        console.warn(
          "[fromhere/products create] aborted by client-side guard (canSubmit/localValidation)",
          {
            canSubmit,
            localValidationOk: localValidation.ok,
          },
        )
      }
      return
    }
    setIsSubmitting(true)
    try {
      const payload = {
        title: localValidation.value.title,
        tagline: localValidation.value.tagline,
        description: localValidation.value.description ?? "",
        category: localValidation.value.category,
        tags: localValidation.value.tags,
        productUrl: localValidation.value.productUrl,
        appIconPath: localValidation.value.appIconPath,
        screenshotPath: localValidation.value.screenshotPath,
        scheduledDate,
        firstComment: firstComment.trim().length > 0 ? firstComment : undefined,
      } as const

      if (typeof window !== "undefined") {
        console.info("[fromhere/products create] calling server action with payload", payload)
      }

      const result = await createFromHereProductAction(payload)

      if (typeof window !== "undefined") {
        console.info("[fromhere/products create] server action returned", result)
      }

      if (!result.ok) {
        if (typeof window !== "undefined") {
          console.error("[fromhere/products create] action failed", {
            errorKey: result.error,
            payload,
          })
        }
        if (result.error === "unauthorized") {
          setNotice({ variant: "error", message: tErr("sessionExpired") })
          router.replace("/fromhere/signin")
          return
        }
        if (result.error === "profile_missing") {
          router.replace("/fromhere/onboarding")
          return
        }
        const message = resolveServerErrorMessage(result.error, tErr)
        setNotice({ variant: "error", message })
        return
      }

      setNotice(toSuccessNotice(t("successToast")))
      redirectedRef.current = true
      leavingRef.current = true
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SUBMIT_DRAFT_STORAGE_KEY)
      }
      /**
       * 遷移は `router.replace` + `router.refresh` の組み合わせで行う。
       * - Server Action 内で `revalidatePath("/fromhere")` を呼んでいるためサーバー側
       *   Data Cache は最新だが、Client 側 Router Cache を確実に invalidate するため
       *   `router.refresh()` も併用する（万一 Router Cache に古い /fromhere が残って
       *   いる場合の保険）。
       * - 順序は `replace → refresh`。先に遷移を開始しておき、refresh は遷移後の
       *   page に対する追加 fetch として扱う。
       */
      router.replace("/fromhere")
      router.refresh()
    } catch (error) {
      if (typeof window !== "undefined") {
        console.error("[fromhere/products create] unexpected exception in handleSubmit", error)
      }
      setNotice(toErrorNotice(error, false))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-20 text-sm text-muted-foreground">
        <Loader2 className="mb-3 h-5 w-5 animate-spin" />
        {authLoading ? t("checking") : t("redirecting")}
      </div>
    )
  }

  const previewIconUrl = appIcon.state === "done" ? appIcon.previewUrl : null
  const previewScreenshotUrl = screenshot.state === "done" ? screenshot.previewUrl : null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:py-12">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      {/**
       * 離脱確認モーダル。
       *
       * - 戻るボタン or 「← FromHere」リンクから離脱しようとした時に表示。
       * - 「破棄して戻る」を押すと localStorage と Storage 上の画像を掃除して遷移する。
       * - 「キャンセル」を押すと閉じてフォームに戻る（ダミー履歴は積み直し済みなので、
       *   再度戻るボタンを押すと再びこのモーダルが出る）。
       */}
      {leaveModal.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nv_leave_title"
        >
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 id="nv_leave_title" className="text-base font-semibold text-foreground">
              {t("leaveConfirmTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("leaveConfirmBody")}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelLeave}>
                {t("leaveConfirmCancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void confirmLeave()}
                className="bg-rose-500 text-white hover:bg-rose-500/90"
              >
                {t("leaveConfirmConfirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t("title")}</h1>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* Basics */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{t("section.basics")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_title">
                  {t("titleLabel")}
                </label>
                <Input
                  id="nv_title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value.slice(0, FROMHERE_TITLE_MAX))}
                  placeholder={t("titlePlaceholder")}
                  maxLength={FROMHERE_TITLE_MAX}
                  className="border-input bg-background"
                />
                <div className="flex items-center justify-end text-xs text-muted-foreground">
                  <span>
                    {title.length} / {FROMHERE_TITLE_MAX}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_tagline">
                  {t("taglineLabel")}
                </label>
                <Input
                  id="nv_tagline"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value.slice(0, FROMHERE_TAGLINE_MAX))}
                  placeholder={t("taglinePlaceholder")}
                  maxLength={FROMHERE_TAGLINE_MAX}
                  className="border-input bg-background"
                />
                <div className="flex items-center justify-end text-xs text-muted-foreground">
                  <span>
                    {tagline.length} / {FROMHERE_TAGLINE_MAX}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_category">
                  {t("categoryLabel")}
                </label>
                <select
                  id="nv_category"
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
                <p className="text-xs text-muted-foreground">{t("categoryHelp")}</p>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{t("section.details")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_description">
                  {t("descriptionLabel")}
                </label>
                <textarea
                  id="nv_description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, FROMHERE_DESCRIPTION_MAX))}
                  placeholder={t("descriptionPlaceholder")}
                  maxLength={FROMHERE_DESCRIPTION_MAX}
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex items-center justify-between text-xs">
                  {containsFromHereDescriptionHtml(description) ? (
                    <span className="text-rose-500">{tErr("descriptionHtml")}</span>
                  ) : (
                    <span />
                  )}
                  <span className="text-muted-foreground">
                    {description.length} / {FROMHERE_DESCRIPTION_MAX}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_tags">
                  {t("tagsLabel")}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="nv_tags"
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
                    onClick={() => handleAddTag()}
                    disabled={!tagInput.trim() || tags.length >= FROMHERE_TAG_MAX_COUNT}
                  >
                    {t("tagsAddAction")}
                  </Button>
                </div>
                {/* 推奨タグ chip: クリックで現在のタグ集合に追加。既に選ばれているもの・上限到達時は disable */}
                {(() => {
                  const tagSet = new Set(tags.map((tag) => tag.toLowerCase()))
                  const limitReached = tags.length >= FROMHERE_TAG_MAX_COUNT
                  return (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("tagsSuggestionsHeading")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {FROMHERE_SUGGESTED_TAGS.map((suggestion) => {
                          const isSelected = tagSet.has(suggestion.toLowerCase())
                          const disabled = isSelected || limitReached
                          return (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => handleAddTag(suggestion)}
                              disabled={disabled}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                isSelected
                                  ? "cursor-default border-primary/40 bg-primary/10 text-primary"
                                  : disabled
                                    ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50"
                                    : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                              )}
                              aria-pressed={isSelected}
                            >
                              {isSelected ? null : <Plus className="h-3 w-3" aria-hidden />}
                              {suggestion}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
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
                {/**
                 * tagInput に許可されていない文字が含まれている場合のみ注意文を表示。
                 * 何も入力されていない・許容文字のみの場合は何も出さない（常時ヘルプは廃止）。
                 */}
                {tagInput.length > 0 && !isFromHereTagCharsAllowed(tagInput) ? (
                  <p className="text-xs text-rose-500">{tErr("tagsCharset")}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_url">
                  {t("productUrlLabel")}
                </label>
                <Input
                  id="nv_url"
                  type="url"
                  inputMode="url"
                  value={productUrl}
                  onChange={(event) => setProductUrl(event.target.value)}
                  placeholder={t("productUrlPlaceholder")}
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
               * 公開日（JST）
               * - `<input type="date">` で日付ピッカーを出す。`min` を翌日に設定。
               * - サーバー側でも `parseFromHereScheduledDateToUtcIso` で再検証。
               */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_scheduled_date">
                  {t("scheduledDateLabel")}
                </label>
                <Input
                  id="nv_scheduled_date"
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
                   * 「翌日以降か」「フォーマット不正か」「運営側で禁止された日付か」を
                   * 区別してエラーメッセージを切り替える。`isFromHereBlockedScheduledDate`
                   * は文字列比較で判定するため日付不正でも安全に false を返す。
                   */
                  <p className="text-xs text-red-500">
                    {isFromHereBlockedScheduledDate(scheduledDate)
                      ? tErr("scheduledDateBlocked")
                      : tErr("scheduledDate")}
                  </p>
                )}
              </div>

              {/**
               * 最初のコメント（任意）
               * - 公開時刻 = `posted_at` と同じ瞬間にコメントとして保存される。
               * - 本欄は plain text の想定。サーバー側で HTML タグなどを最終検証する。
               */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="nv_first_comment">
                  {t("firstCommentLabel")}
                </label>
                <textarea
                  id="nv_first_comment"
                  value={firstComment}
                  onChange={(event) =>
                    setFirstComment(event.target.value.slice(0, FROMHERE_COMMENT_MAX_LENGTH))
                  }
                  placeholder={t("firstCommentPlaceholder")}
                  maxLength={FROMHERE_COMMENT_MAX_LENGTH}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex items-center justify-between text-xs">
                  {firstCommentTooLong ? (
                    <span className="text-rose-500">{tErr("firstCommentTooLong")}</span>
                  ) : (
                    <span className="text-muted-foreground">{t("firstCommentHelp")}</span>
                  )}
                  <span className="text-muted-foreground">
                    {firstComment.length} / {FROMHERE_COMMENT_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{t("section.media")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ImageUploadField
                kind="app_icon"
                label={t("appIconLabel")}
                help={t("appIconHelp")}
                chooseText={t("appIconChoose")}
                replaceText={t("appIconReplace")}
                removeText={t("appIconRemove")}
                uploadingText={t("appIconUploading")}
                upload={appIcon}
                onSelect={(file) => void handleFileSelect("app_icon", file)}
                onRemove={() => void handleRemoveUploaded("app_icon")}
                square
                required
                requiredLabel={t("requiredMark")}
              />
              <ImageUploadField
                kind="screenshot"
                label={t("screenshotLabel")}
                help={t("screenshotHelp")}
                chooseText={t("screenshotChoose")}
                replaceText={t("screenshotReplace")}
                removeText={t("screenshotRemove")}
                uploadingText={t("screenshotUploading")}
                upload={screenshot}
                onSelect={(file) => void handleFileSelect("screenshot", file)}
                onRemove={() => void handleRemoveUploaded("screenshot")}
                square={false}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 lg:hidden">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
            {!canSubmit ? (
              <p className="text-center text-xs text-muted-foreground">{t("submitDisabledHint")}</p>
            ) : null}
          </div>
        </div>

        {/* Preview & Submit (right column on PC) */}
        <aside className="space-y-4 lg:sticky lg:top-[5rem] lg:self-start">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{t("section.preview")}</CardTitle>
              <CardDescription className="text-xs">{t("previewHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewCard
                title={title}
                tagline={tagline}
                tags={tags}
                category={category}
                productUrl={productUrl}
                iconUrl={previewIconUrl}
                screenshotUrl={previewScreenshotUrl}
                displayName={profile?.display_name ?? ""}
                handle={profile?.handle ?? ""}
                postedByLabel={t("previewPostedBy")}
              />
            </CardContent>
          </Card>

          <div className="hidden flex-col gap-3 lg:flex">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
            {!canSubmit ? (
              <p className="text-center text-xs text-muted-foreground">{t("submitDisabledHint")}</p>
            ) : null}
            <Link
              href="/fromhere"
              onClick={(event) => {
                event.preventDefault()
                requestLeaveTo("/fromhere")
              }}
              className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← FromHere
            </Link>
          </div>
        </aside>
      </form>
    </div>
  )
}

type ImageUploadFieldProps = {
  kind: FromHereUploadKind
  label: string
  help: string
  chooseText: string
  replaceText: string
  removeText: string
  uploadingText: string
  upload: UploadState
  onSelect: (file: File | null) => void
  onRemove: () => void
  square: boolean
  /** true の場合、ラベル横に必須マーク (`requiredLabel`) を赤色で表示する。 */
  required?: boolean
  requiredLabel?: string
}

function ImageUploadField({
  kind,
  label,
  help,
  chooseText,
  replaceText,
  removeText,
  uploadingText,
  upload,
  onSelect,
  onRemove,
  square,
  required,
  requiredLabel,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = `nv_${kind}_input`

  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span aria-label={requiredLabel} className="text-xs font-semibold text-red-500">
            {requiredLabel ?? "*"}
          </span>
        ) : null}
      </span>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 sm:flex-row sm:items-center",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background",
            // アイコンは正方形固定。スクリーンショットはアップロード後だけ高さを画像比に
            // 合わせるため、`h-20` を外して `w-32` のみで縦方向は自動伸縮させる。
            square
              ? "h-20 w-20"
              : upload.state === "done"
                ? "w-32"
                : "h-20 w-32",
          )}
        >
          {upload.state === "done" ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage の object URL を表示するだけのプレビュー用
            <img
              src={upload.previewUrl}
              alt=""
              className={cn(
                "block",
                // アイコン: 中央クロップでサムネ的に表示。
                // スクリーンショット: 横幅に合わせて高さ自動。枠は画像比に伸縮する。
                square ? "h-full w-full object-cover" : "h-auto w-full",
              )}
            />
          ) : upload.state === "uploading" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={FROMHERE_ALLOWED_IMAGE_MIME.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              onSelect(file)
              event.target.value = ""
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={upload.state === "uploading"}
            >
              <Upload className="mr-1 h-3.5 w-3.5" aria-hidden />
              {upload.state === "done" ? replaceText : chooseText}
            </Button>
            {upload.state === "done" ? (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                {removeText}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{upload.state === "uploading" ? uploadingText : help}</p>
        </div>
      </div>
    </div>
  )
}

type PreviewCardProps = {
  title: string
  tagline: string
  tags: string[]
  category: FromHereCategory
  productUrl: string
  iconUrl: string | null
  screenshotUrl: string | null
  displayName: string
  handle: string
  postedByLabel: string
}

function PreviewCard({
  title,
  tagline,
  tags,
  category,
  productUrl,
  iconUrl,
  screenshotUrl,
  displayName,
  handle,
  postedByLabel,
}: PreviewCardProps) {
  const tCat = useTranslations("fromhere.filters")
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage の object URL を表示するだけのプレビュー用
            <img src={iconUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{title || "—"}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{tagline || "—"}</p>
        </div>
      </div>

      {screenshotUrl ? (
        // 画像の自然なアスペクト比に枠を合わせて、上下や左右に隙間が出ないようにする。
        // 横幅はカードに合わせ、高さは画像比に応じて自動。
        <div className="mt-3 overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- Storage の object URL を表示するだけのプレビュー用 */}
          <img src={screenshotUrl} alt="" className="block h-auto w-full" />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
          {tCat(`category${capitalize(category)}`)}
        </span>
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground"
          >
            <TagIcon className="h-3 w-3" aria-hidden />
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">
          {postedByLabel}: {displayName || "—"}
          {handle ? ` (@${handle})` : ""}
        </span>
        {productUrl && isSafeProductUrl(productUrl) ? (
          <a
            href={productUrl}
            target="_blank"
            rel="noreferrer noopener nofollow"
            className="inline-flex items-center gap-1 truncate underline-offset-4 hover:text-foreground hover:underline"
          >
            <Plus className="h-3 w-3 rotate-45" aria-hidden />
            {new URL(productUrl).host}
          </a>
        ) : null}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1)
}

function resolveServerErrorMessage(
  key: string,
  tErr: (k: string, values?: Record<string, string | number>) => string,
): string {
  switch (key) {
    case "title":
      return tErr("title", { max: FROMHERE_TITLE_MAX })
    case "tagline":
      return tErr("tagline", { max: FROMHERE_TAGLINE_MAX })
    case "description":
      return tErr("description", { max: FROMHERE_DESCRIPTION_MAX })
    case "category":
    case "tags":
    case "tagsCharset":
    case "productUrl":
    case "productUrlScheme":
    case "appIcon":
    case "appIconRequired":
    case "screenshot":
    case "rateLimit":
    case "duplicate":
    case "sessionExpired":
    case "scheduledDate":
    case "firstComment":
    case "firstCommentTooLong":
      return tErr(key)
    case "rate_limited":
      return tErr("rateLimit")
    default:
      return tErr("submitFailed")
  }
}
