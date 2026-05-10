"use client"

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getIsAdminFromProfile } from "@/lib/admin"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

const CONTACT_CATEGORY_OPTIONS = [
  "ご意見",
  "不具合報告",
  "ユーザー・商品のBAN",
  "異議申し立てについて",
  "ご質問",
  "その他",
] as const
const SUBJECT_MAX_LENGTH = 40
const CONTENT_MAX_LENGTH = 2000
const CONTACT_ATTACHMENTS_PREFIX = "attachments"
const TRANSACTION_ID_MAX_DIGITS = 19

type ContactFormState = {
  name: string
  email: string
  category: string
  subject: string
  transactionId: string
  content: string
}

const DEFAULT_FORM: ContactFormState = {
  name: "",
  email: "",
  category: "",
  subject: "",
  transactionId: "",
  content: "",
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidInt8LikeId(value: string) {
  return /^\d{1,19}$/.test(value)
}

function cleanStoragePath(path: string): string {
  return path.trim().replace(/[\r\n]/g, "")
}

export default function ContactPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [form, setForm] = useState<ContactFormState>(DEFAULT_FORM)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    isValidEmail(form.email.trim()) &&
    form.category.trim().length > 0 &&
    form.subject.trim().length > 0 &&
    form.content.trim().length > 0

  useEffect(() => {
    if (!attachment) {
      setAttachmentPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(attachment)
    setAttachmentPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [attachment])

  useEffect(() => {
    let mounted = true
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) {
        return
      }
      if (!data.user?.id) {
        setIsAdmin(false)
        return
      }
      const adminFlag = await getIsAdminFromProfile(supabase, data.user.id)
      if (!mounted) {
        return
      }
      setIsAdmin(adminFlag)
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  const handleChange =
    (field: keyof ContactFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
    }

  const handleAttachmentSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!file) {
      return
    }
    if (!file.type.startsWith("image/")) {
      setNotice({ variant: "error", message: "添付ファイルは画像を選択してください。" })
      return
    }
    setNotice(null)
    setAttachment(file)
  }

  const handleAttachmentClear = () => {
    setAttachment(null)
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = ""
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !canSubmit) {
      return
    }
    setNotice(null)

    const name = form.name.trim()
    const email = form.email.trim()
    const category = form.category.trim()
    const subject = form.subject.trim()
    const transactionId = form.transactionId.trim()
    const content = form.content.trim()

    if (!name || !email || !category || !subject || !content) {
      setNotice({ variant: "error", message: "必須項目をすべて入力してください。" })
      return
    }
    if (!isValidEmail(email)) {
      setNotice({ variant: "error", message: "メールアドレスの形式が正しくありません。" })
      return
    }
    if (subject.length > SUBJECT_MAX_LENGTH) {
      setNotice({ variant: "error", message: `件名は${SUBJECT_MAX_LENGTH}文字以内で入力してください。` })
      return
    }
    if (content.length > CONTENT_MAX_LENGTH) {
      setNotice({ variant: "error", message: `内容は${CONTENT_MAX_LENGTH}文字以内で入力してください。` })
      return
    }
    if (transactionId.length > 0 && !isValidInt8LikeId(transactionId)) {
      setNotice({
        variant: "error",
        message: `取引IDは数字のみ${TRANSACTION_ID_MAX_DIGITS}桁以内で入力してください。`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      let uploadedAttachmentPath: string | null = null
      if (attachment) {
        const safeFileName = crypto.randomUUID().replace(/-/g, "")
        const fullAttachmentPath = cleanStoragePath(`${CONTACT_ATTACHMENTS_PREFIX}/${safeFileName}`)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("contact-attachments")
          .upload(fullAttachmentPath, attachment, {
            contentType: attachment.type || undefined,
            upsert: false,
          })

        if (uploadError || !uploadData?.path) {
          throw uploadError ?? new Error("添付ファイルのアップロードに失敗しました。")
        }
        // DB には `attachments/<fileName>` のフルパスを保存する
        uploadedAttachmentPath = cleanStoragePath(fullAttachmentPath)
      }

      const { error: insertError } = await supabase.from("contact_submissions").insert({
        name,
        email,
        category,
        subject,
        transaction_id: transactionId.length > 0 ? transactionId : null,
        content,
        attachment_path: uploadedAttachmentPath,
        status: "pending",
        created_at: new Date().toISOString(),
      })

      if (insertError) {
        throw insertError
      }

      try {
        await fetch("/api/notifications/contact-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            category,
            subject,
          }),
          keepalive: true,
        })
      } catch {
        // Discord 通知失敗で問い合わせ送信自体は失敗扱いにしない
      }

      setForm(DEFAULT_FORM)
      setAttachment(null)
      setNotice(null)
      router.push("/contact/success")
      router.refresh()
    } catch (error) {
      setNotice(
        toErrorNotice(error, isAdmin, {
          unknownErrorMessage: "送信に失敗しました。時間をおいて再度お試しください。",
        }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-zinc-100">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-wide text-white">お問い合わせ</h1>
          <Button
            asChild
            variant="outline"
            className="border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
          >
            <Link href="/">
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                ホームに戻る
              </span>
            </Link>
          </Button>
        </div>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardHeader>
            <CardTitle className="text-white">フォーム入力</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="contact-name" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  名前<span className="text-xs font-medium text-red-400">必須</span>
                </label>
                <Input
                  id="contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange("name")}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-email" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  メールアドレス<span className="text-xs font-medium text-red-400">必須</span>
                </label>
                <Input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange("email")}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-category" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  カテゴリ<span className="text-xs font-medium text-red-400">必須</span>
                </label>
                <select
                  id="contact-category"
                  required
                  value={form.category}
                  onChange={handleChange("category")}
                  className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">選択してください</option>
                  {CONTACT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-subject" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  件名<span className="text-xs font-medium text-red-400">必須</span>
                </label>
                <Input
                  id="contact-subject"
                  type="text"
                  required
                  maxLength={SUBJECT_MAX_LENGTH}
                  value={form.subject}
                  onChange={handleChange("subject")}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-transaction-id" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  取引ID<span className="text-xs font-medium text-zinc-400">任意</span>
                </label>
                <Input
                  id="contact-transaction-id"
                  type="text"
                  value={form.transactionId}
                  onChange={handleChange("transactionId")}
                  className="border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
                />
                <p className="text-xs leading-relaxed text-zinc-400">
                  取引に関するお問い合わせの場合は、マイページの「進行中の取引（受講中 / 対応中）」一覧に表示される
                  「取引ID」をご記入ください。
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="contact-content" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  内容<span className="text-xs font-medium text-red-400">必須</span>
                </label>
                <textarea
                  id="contact-content"
                  required
                  maxLength={CONTENT_MAX_LENGTH}
                  value={form.content}
                  onChange={handleChange("content")}
                  rows={6}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="contact-attachment"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200"
                >
                  添付ファイル<span className="text-xs font-medium text-zinc-400">任意</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <input
                    ref={attachmentInputRef}
                    id="contact-attachment"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={handleAttachmentSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className="h-10 border-zinc-600 bg-zinc-900 text-zinc-200 hover:border-red-500 hover:bg-zinc-800"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    ファイルを選択
                  </Button>
                  <span className="min-h-5 break-all text-xs text-zinc-400 sm:text-sm">
                    {attachment ? attachment.name : "選択されていません"}
                  </span>
                </div>
                {attachmentPreviewUrl ? (
                  <div className="w-full min-w-0">
                    <div className="flex w-36 max-w-full flex-col gap-2">
                      <div className="relative aspect-square w-36 max-w-full overflow-hidden rounded-md border border-zinc-700 bg-zinc-100 p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ローカル画像プレビュー */}
                        <img
                          src={attachmentPreviewUrl}
                          alt="添付画像プレビュー"
                          className="h-full w-full rounded object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAttachmentClear}
                        disabled={isSubmitting}
                        className="h-7 border border-zinc-600 bg-zinc-900 text-xs text-zinc-100 hover:bg-zinc-800"
                      >
                        削除
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="h-11 w-full bg-red-600 text-white hover:bg-red-500"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    送信中...
                  </>
                ) : (
                  "送信する"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
