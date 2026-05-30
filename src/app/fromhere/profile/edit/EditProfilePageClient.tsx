"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlus, Loader2, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { ThumbnailCropModal } from "@/components/thumbnail-crop-modal"
import { useTranslations } from "@/lib/i18n/useI18n"
import { toErrorNotice, toSuccessNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { PROFILE_AVATAR_CROP_EXPORT_PX } from "@/lib/profile-avatar"

import { useFromHereAuth } from "@/fromhere/_auth-context"
import { updateFromHereProfileAction } from "@/fromhere/_profile-actions"
import {
  validateFromHereAvatarFile,
  type FromHereAvatarFileErrorKey,
} from "@/fromhere/_avatar-validation"
import { AVATARS_STORAGE_BUCKET } from "@/lib/avatar-storage"
import {
  FROMHERE_BIO_MAX_LENGTH,
  FROMHERE_DISPLAY_NAME_MAX,
  validateFromHereProfileEdit,
  type FromHereProfileEditErrorKey,
} from "@/fromhere/_profile-validation"

/** ----------------------------------------------------------
 *  視覚フォールバック（イニシャル + グラデーション）
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

/**
 * メーカープロフィール編集ページ。
 *
 * - `useFromHereAuth` から自分の profile を取り、初期値として表示する。
 * - 未ログイン / プロフィール未作成は自動でリダイレクトする（render 中に push しないように useEffect で行う）。
 * - 保存成功時は `refreshProfile()` でコンテキストを最新化し、メーカープロフィールページへ戻す。
 */
/**
 * SSR で取得した初期値の型。
 * `app/fromhere/profile/edit/page.tsx` が DB から fetch して props で渡す。
 */
export type EditProfileInitial = {
  id: string
  handle: string
  displayName: string
  bio: string | null
  /** 本体 `profiles.avatar_url` を最優先で含めた表示用 URL */
  avatarUrl: string | null
  /** 互換用に残しているが、新規書き込みでは使わない */
  avatarPath: string | null
}

export function EditProfilePageClient({ initial }: { initial: EditProfileInitial }) {
  const router = useRouter()
  const t = useTranslations("fromhere.profileEdit")
  const tErrors = useTranslations("fromhere.profileEdit.errors")
  const tAvatar = useTranslations("fromhere.profileEdit.avatar")
  const tAvatarErrors = useTranslations("fromhere.profileEdit.avatar.errors")
  const tHandle = useTranslations("fromhere.profileEdit.handle")
  const { user, loading, refreshProfile } = useFromHereAuth()

  /**
   * SSR 由来の初期値で state を初期化する。
   * AuthContext の `profile` 反映を待たずに最新値を表示できる。
   */
  const [displayName, setDisplayName] = useState<string>(initial.displayName ?? "")
  const [bio, setBio] = useState<string>(initial.bio ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)

  /**
   * アバターの変更状態:
   *   - `undefined`: 未変更（保存時にアバター項目は API へ送らない）
   *   - `null`: ユーザーが「削除」を選択（保存時に DB を NULL に）
   *   - string: 新規アップロード済みの本体 `avatars` バケット内 public URL
   *
   * 仕様（2026-05 再改訂）:
   *   - 画像本体は GritVib 本体と同じ `avatars` バケットに保存（共通ストレージ）。
   *   - DB 上の正本は `newvibes_profiles.avatar_url`（FromHere 専用テーブル）。
   *     `/api/fromhere/profile` PATCH に `avatarUrl` を渡して更新する。
   */
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null | undefined>(undefined)
  /** プレビュー用の Object URL（送信前後で revoke する） */
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  /**
   * クロップモーダル制御。
   * - `cropSourceUrl` は元画像（ユーザーが選択した生ファイル）の Object URL。
   *   モーダル内で参照中はメモリを保持し、閉じる時に revoke する。
   * - クロップ確定 (`onCropConfirm`) で本体共通のロジックが返す JPEG Blob を受け取り、
   *   `avatars` バケットへアップロードする。
   */
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  const redirectedRef = useRef(false)

  /** unmount / 切替時に Object URL を release */
  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl)
      }
    }
  }, [previewObjectUrl])

  /**
   * 認証ガード（Client 側）。
   *
   * 認証 + プロフィール作成済みの判定は **SSR (`app/fromhere/profile/edit/page.tsx`)**
   * で完結している。クライアントでは、ページ滞在中にセッションが切れた場合のみ
   * サインインへリダイレクトする。`profile === null` での onboarding 自動リダイレクトは
   * `onAuthStateChange` 直後の一時的な null を誤判定する原因となるため行わない。
   */
  useEffect(() => {
    if (loading || redirectedRef.current) {
      return
    }
    if (!user) {
      redirectedRef.current = true
      router.replace("/fromhere/signin")
    }
  }, [loading, user, router])

  const bioRemaining = useMemo(() => FROMHERE_BIO_MAX_LENGTH - bio.length, [bio])
  const displayNameRemaining = useMemo(
    () => FROMHERE_DISPLAY_NAME_MAX - displayName.trim().length,
    [displayName],
  )

  /**
   * ファイル選択直後の挙動。
   *
   * 直接アップロードせず、まずクロップモーダルを開く。ユーザーが切り抜きを確定する
   * までは Storage へ書き込まない（モーダルを閉じてキャンセルすれば何も残らない）。
   */
  const onAvatarFileSelected = (file: File | null) => {
    if (!file || !user) {
      return
    }
    const fileCheck = validateFromHereAvatarFile(file)
    if (!fileCheck.ok) {
      setNotice({ variant: "error", message: localizedAvatarFileError(fileCheck.error, tAvatarErrors) })
      return
    }
    setCropSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(fileCheck.file)
    })
    setCropOpen(true)
  }

  const onCropClose = () => {
    setCropOpen(false)
    setCropSourceUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  /**
   * クロップ後の JPEG Blob を `avatars` バケットへアップロードする。
   *
   * - 本体共通のロジック (`ThumbnailCropModal`) で 1:1 / `PROFILE_AVATAR_CROP_EXPORT_PX`
   *   ピクセルの JPEG が常に保証されるため、追加のサイズ検証は不要。
   * - DB 更新は保存ボタン押下時にまとめて行う（ここでは `pendingAvatarUrl` に格納するだけ）。
   */
  const onCropConfirm = async (blob: Blob) => {
    if (!user) {
      return
    }
    setUploadingAvatar(true)
    try {
      const random =
        typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
          ? globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : Math.random().toString(36).slice(2, 14)
      const filename = `avatar-${random}.jpg`
      const storagePath = `${user.id}/${filename}`
      const file = new File([blob], filename, { type: "image/jpeg" })

      const supabase = getSupabaseBrowserClient()
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: "image/jpeg",
          upsert: false,
        })
      if (uploadError) {
        setNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATARS_STORAGE_BUCKET).getPublicUrl(storagePath)
      if (!publicUrl) {
        setNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
        return
      }

      const objectUrl = URL.createObjectURL(file)
      // 前回 Object URL は revoke してから差し替え
      setPreviewObjectUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }
        return objectUrl
      })
      setPendingAvatarUrl(publicUrl)
    } catch {
      setNotice({ variant: "error", message: tAvatarErrors("uploadFailed") })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const onRemoveAvatar = () => {
    if (uploadingAvatar || submitting) {
      return
    }
    const confirmed = window.confirm(tAvatar("removeConfirm"))
    if (!confirmed) {
      return
    }
    setPreviewObjectUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev)
      }
      return null
    })
    setPendingAvatarUrl(null)
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || uploadingAvatar) {
      return
    }
    const validation = validateFromHereProfileEdit({ displayName, bio })
    if (!validation.ok) {
      setNotice({ variant: "error", message: localizedClientError(validation.error, tErrors) })
      return
    }

    const payload: {
      displayName: string
      bio: string
      avatarUrl?: string | null
    } = {
      displayName: validation.value.displayName,
      bio: validation.value.bio ?? "",
    }
    if (pendingAvatarUrl !== undefined) {
      payload.avatarUrl = pendingAvatarUrl
    }

    setSubmitting(true)
    try {
      const result = await updateFromHereProfileAction(payload)

      if (!result.ok) {
        if (typeof window !== "undefined") {
           
          console.error("[fromhere/profile update] action failed", { errorKey: result.error })
        }
        const message = mapServerErrorToMessage(result.error, tErrors)
        setNotice({ variant: "error", message })
        return
      }

      await refreshProfile()
      setNotice(toSuccessNotice(t("success")))
      router.push(`/fromhere/u/${initial.handle}`)
    } catch (error) {
      setNotice(
        toErrorNotice(error ?? new Error(tErrors("saveFailed")), false, {
          unknownErrorMessage: tErrors("saveFailed"),
        }),
      )
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * 認証セッションが落ちた場合のみ「読み込み中」を出す。
   * 通常は SSR で profile を必ず取得しているため、ここでブロックすることはない。
   */
  if (loading) {
    return (
      <main className="box-border flex min-h-[40vh] w-full items-center justify-center bg-background px-4 py-16 text-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="box-border w-full min-w-0 max-w-full bg-background pb-16 text-foreground">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}

      <section className="border-b border-border bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-10">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {t("heading")}
          </h1>
        </div>
      </section>

      <ThumbnailCropModal
        open={cropOpen}
        imageSrc={cropSourceUrl}
        onClose={onCropClose}
        onConfirm={onCropConfirm}
        cropShape="avatar"
        outputPixelSize={{
          width: PROFILE_AVATAR_CROP_EXPORT_PX,
          height: PROFILE_AVATAR_CROP_EXPORT_PX,
        }}
      />

      <section className="mx-auto w-full max-w-2xl px-4 pt-8 md:px-8">
        <form className="space-y-6" onSubmit={(e) => void onSubmit(e)}>
          {/* ----- アバター ----- */}
          <AvatarPicker
            label={tAvatar("label")}
            uploadAction={tAvatar("uploadAction")}
            changeAction={tAvatar("changeAction")}
            uploadingLabel={tAvatar("uploading")}
            removeAction={tAvatar("remove")}
            previewAlt={tAvatar("preview")}
            displayUrl={
              previewObjectUrl ??
              (pendingAvatarUrl === null
                ? null
                : pendingAvatarUrl ?? initial.avatarUrl ?? null)
            }
            fallbackSeed={initial.id}
            fallbackInitials={getInitials(displayName || initial.displayName || initial.handle)}
            uploading={uploadingAvatar}
            disabled={submitting}
            hasCurrentImage={Boolean(
              previewObjectUrl ||
                (pendingAvatarUrl !== null && (pendingAvatarUrl || initial.avatarUrl)),
            )}
            onFileSelected={(file) => void onAvatarFileSelected(file)}
            onRemove={onRemoveAvatar}
          />

          <HandleSection currentHandle={initial.handle} lockedNotice={tHandle("lockedNotice")} />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fromhere_edit_display_name">
              {t("displayNameLabel")}
            </label>
            <Input
              id="fromhere_edit_display_name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={FROMHERE_DISPLAY_NAME_MAX + 10}
              required
              className="h-10"
              autoComplete="nickname"
            />
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <span className={displayNameRemaining < 0 ? "text-red-500" : ""}>
                {Math.max(0, displayName.trim().length)} / {FROMHERE_DISPLAY_NAME_MAX}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="fromhere_edit_bio">
              {t("bioLabel")}
            </label>
            <textarea
              id="fromhere_edit_bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={FROMHERE_BIO_MAX_LENGTH + 30}
              rows={5}
              className="flex min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="flex items-center justify-end text-xs text-muted-foreground">
              <span className={bioRemaining < 0 ? "text-red-500" : ""}>
                {bio.length} / {FROMHERE_BIO_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {submitting ? t("submitting") : t("submit")}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/fromhere/u/${initial.handle}`}>{t("cancel")}</Link>
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

/** クライアント検証エラーキーを表示文字列に変換 */
function localizedClientError(
  key: FromHereProfileEditErrorKey,
  tErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (key === "bioTooLong") {
    return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
  }
  return tErrors(key)
}

/** クライアント側のファイル検証エラーキーを表示文字列に変換 */
function localizedAvatarFileError(
  key: FromHereAvatarFileErrorKey,
  tAvatarErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (key) {
    case "tooLarge":
      return tAvatarErrors("tooLarge")
    case "invalidType":
      return tAvatarErrors("invalidType")
    case "noFile":
    default:
      return tAvatarErrors("uploadFailed")
  }
}

/** ----------------------------------------------------------
 *  アバターピッカー UI
 * ---------------------------------------------------------- */
type AvatarPickerProps = {
  label: string
  /** 補助テキスト。未指定 / 空文字なら描画しない（UI 側でスペースも空ける必要が無い） */
  hint?: string
  uploadAction: string
  changeAction: string
  uploadingLabel: string
  removeAction: string
  previewAlt: string
  displayUrl: string | null
  fallbackSeed: string
  fallbackInitials: string
  uploading: boolean
  disabled: boolean
  hasCurrentImage: boolean
  onFileSelected: (file: File | null) => void
  onRemove: () => void
}

function AvatarPicker(props: AvatarPickerProps) {
  const gradient = pickFallbackGradient(props.fallbackSeed)
  /**
   * file input の ref は本コンポーネント内で完結させる。
   * React Compiler のルールにより、ref を別コンポーネントへ props として渡せないため。
   */
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onClickPick = () => {
    if (props.uploading || props.disabled) {
      return
    }
    inputRef.current?.click()
  }

  const onChangeFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    // 同じファイルを再選択した時にも change が発火するように value をリセット
    event.target.value = ""
    props.onFileSelected(file)
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{props.label}</label>
      <div className="flex items-start gap-4">
        <div
          aria-label={props.previewAlt}
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-background sm:h-24 sm:w-24",
            props.displayUrl ? "bg-muted" : `bg-gradient-to-br ${gradient}`,
          )}
        >
          {props.displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 画像 / ObjectURL のプレビュー
            <img
              src={props.displayUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-white sm:text-3xl">
              {props.fallbackInitials}
            </span>
          )}
          {props.uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {props.hint ? (
            <p className="text-xs text-muted-foreground">{props.hint}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={props.uploading || props.disabled}
              onClick={onClickPick}
              className="gap-1.5"
            >
              <ImagePlus className="h-4 w-4" aria-hidden />
              {props.uploading
                ? props.uploadingLabel
                : props.hasCurrentImage
                  ? props.changeAction
                  : props.uploadAction}
            </Button>
            {props.hasCurrentImage ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={props.uploading || props.disabled}
                onClick={props.onRemove}
                className="gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {props.removeAction}
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onChangeFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  )
}

/** ----------------------------------------------------------
 *  ハンドルセクション（読み取り専用 / 永続ロック）
 *
 *  仕様: 本体「カスタムID」と同じく、一度設定したハンドルは
 *        プロフィール編集ページからは変更も削除もできない。
 *
 *  - 初回設定は `/fromhere/onboarding` でのみ行う。
 *  - DB 側でも `BEFORE UPDATE OF handle` トリガで弾かれる。
 *  - API `/api/fromhere/profile` PATCH も `handleLocked` エラーで拒否。
 * ---------------------------------------------------------- */
function HandleSection({
  currentHandle,
  lockedNotice,
}: {
  currentHandle: string
  lockedNotice: string
}) {
  const t = useTranslations("fromhere.profileEdit")
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground" htmlFor="fromhere_edit_handle">
        {t("handleLabel")}
      </label>
      <Input
        id="fromhere_edit_handle"
        type="text"
        value={`@${currentHandle}`}
        disabled
        className="h-10 cursor-not-allowed bg-muted/40 text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">{lockedNotice}</p>
    </div>
  )
}

/** サーバーからのエラーコードを表示文字列に変換 */
function mapServerErrorToMessage(
  errorCode: string | undefined,
  tErrors: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (errorCode) {
    case "displayNameRequired":
      return tErrors("displayNameRequired")
    case "displayNameTooLong":
      return tErrors("displayNameTooLong")
    case "bioTooLong":
      return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
    case "rate_limited":
      return tErrors("rateLimited")
    case "displayName":
      // 旧 POST API のエラーコード互換
      return tErrors("displayNameRequired")
    case "bio":
      return tErrors("bioTooLong", { max: FROMHERE_BIO_MAX_LENGTH })
    case "avatarPath":
      return tErrors("avatarPath")
    case "avatarOwner":
      return tErrors("avatarOwner")
    case "avatarMissing":
      return tErrors("avatarMissing")
    case "avatarUrl":
      return tErrors("avatarPath")
    case "origin":
    case "internal":
    case "not_found":
    default:
      return tErrors("saveFailed")
  }
}
