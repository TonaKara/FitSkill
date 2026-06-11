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

/**
 * Japan Entry Support 専用フォームのカテゴリ。
 * - DB に保存される値は既存ロジックと揃えて日本語固定。
 * - "その他" は既存 /contact フォームの "その他" と DB 値が衝突するため
 *   "その他（Japan Entry）" として区別する（フォーム上の表記は "Other" のまま）。
 * - "相談" / "質問" は既存値と被らないので、そのままの日本語値を使用する。
 */
const CONTACT_CATEGORY_OPTIONS = [
  { value: "相談", label: "Consultation" },
  { value: "質問", label: "Question" },
  { value: "その他（Japan Entry）", label: "Other" },
] as const

const SUBJECT_MAX_LENGTH = 40
const CONTENT_MAX_LENGTH = 2000
const CONTACT_ATTACHMENTS_PREFIX = "attachments"

type ContactFormState = {
  name: string
  email: string
  category: string
  subject: string
  content: string
}

const DEFAULT_FORM: ContactFormState = {
  name: "",
  email: "",
  category: "",
  subject: "",
  content: "",
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function cleanStoragePath(path: string): string {
  return path.trim().replace(/[\r\n]/g, "")
}

export default function JapanEntryContactPage() {
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

  /**
   * Object URL のメモリ解放は副作用のためイベントハンドラ側で完結させる。
   * `useEffect` 内で setState しない構成にすることで `react-hooks/set-state-in-effect`
   * を回避しつつ、ロジックの等価性（添付選択 → プレビュー / クリア → 解放）を維持する。
   */
  const releaseAttachmentPreview = () => {
    if (attachmentPreviewUrl) {
      URL.revokeObjectURL(attachmentPreviewUrl)
    }
  }

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
      setNotice({ variant: "error", message: "Please attach an image file." })
      return
    }
    releaseAttachmentPreview()
    setNotice(null)
    setAttachment(file)
    setAttachmentPreviewUrl(URL.createObjectURL(file))
  }

  const handleAttachmentClear = () => {
    releaseAttachmentPreview()
    setAttachment(null)
    setAttachmentPreviewUrl(null)
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
    const content = form.content.trim()

    if (!name || !email || !category || !subject || !content) {
      setNotice({ variant: "error", message: "Please fill in all required fields." })
      return
    }
    if (!isValidEmail(email)) {
      setNotice({ variant: "error", message: "Email address format is invalid." })
      return
    }
    if (subject.length > SUBJECT_MAX_LENGTH) {
      setNotice({
        variant: "error",
        message: `Subject must be ${SUBJECT_MAX_LENGTH} characters or less.`,
      })
      return
    }
    if (content.length > CONTENT_MAX_LENGTH) {
      setNotice({
        variant: "error",
        message: `Message must be ${CONTENT_MAX_LENGTH} characters or less.`,
      })
      return
    }

    setIsSubmitting(true)
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      const submitterProfileId = authUser?.id ?? null

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
          throw uploadError ?? new Error("Failed to upload attachment.")
        }
        uploadedAttachmentPath = cleanStoragePath(fullAttachmentPath)
      }

      const { error: insertError } = await supabase.from("contact_submissions").insert({
        name,
        email,
        category,
        subject,
        transaction_id: null,
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
            submitter_profile_id: submitterProfileId,
          }),
          keepalive: true,
        })
      } catch {
        // Discord 通知失敗で問い合わせ送信自体は失敗扱いにしない
      }

      releaseAttachmentPreview()
      setForm(DEFAULT_FORM)
      setAttachment(null)
      setAttachmentPreviewUrl(null)
      setNotice(null)
      router.push("/japan-entry/contact/success")
      router.refresh()
    } catch (error) {
      setNotice(
        toErrorNotice(error, isAdmin, {
          unknownErrorMessage: "Failed to submit. Please try again later.",
        }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full px-4 py-10 md:px-8 md:py-14">
      {notice ? <NotificationToast notice={notice} onClose={() => setNotice(null)} /> : null}
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
            Talk to us
          </h1>
          <Button
            asChild
            variant="outline"
            className="border-border bg-background text-foreground hover:border-primary hover:bg-muted"
          >
            <Link href="/japan-entry">
              <span className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </span>
            </Link>
          </Button>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground md:text-base">
          Tell us about your launch, ask a question, or just say hi.
          We respond from Tokyo, in English — usually within 1–2 business days.
        </p>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Inquiry Form</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-name"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Name
                  <span className="text-xs font-medium text-red-400">Required</span>
                </label>
                <Input
                  id="japan-entry-contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={handleChange("name")}
                  className="focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-email"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Email
                  <span className="text-xs font-medium text-red-400">Required</span>
                </label>
                <Input
                  id="japan-entry-contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange("email")}
                  className="focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-category"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Category
                  <span className="text-xs font-medium text-red-400">Required</span>
                </label>
                <select
                  id="japan-entry-contact-category"
                  required
                  value={form.category}
                  onChange={handleChange("category")}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Please select</option>
                  {CONTACT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-subject"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Subject
                  <span className="text-xs font-medium text-red-400">Required</span>
                </label>
                <Input
                  id="japan-entry-contact-subject"
                  type="text"
                  required
                  maxLength={SUBJECT_MAX_LENGTH}
                  value={form.subject}
                  onChange={handleChange("subject")}
                  className="focus-visible:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-content"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Message
                  <span className="text-xs font-medium text-red-400">Required</span>
                </label>
                <textarea
                  id="japan-entry-contact-content"
                  required
                  maxLength={CONTENT_MAX_LENGTH}
                  value={form.content}
                  onChange={handleChange("content")}
                  rows={6}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="japan-entry-contact-attachment"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground"
                >
                  Attachment
                  <span className="text-xs font-medium text-muted-foreground">Optional</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <input
                    ref={attachmentInputRef}
                    id="japan-entry-contact-attachment"
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
                    className="h-10 border-border bg-background text-foreground hover:border-red-500 hover:bg-muted"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <span className="min-h-5 break-all text-xs text-muted-foreground sm:text-sm">
                    {attachment ? attachment.name : "No file chosen"}
                  </span>
                </div>
                {attachmentPreviewUrl ? (
                  <div className="w-full min-w-0">
                    <div className="flex w-36 max-w-full flex-col gap-2">
                      <div className="relative aspect-square w-36 max-w-full overflow-hidden rounded-md border border-border bg-muted p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ローカル画像プレビュー */}
                        <img
                          src={attachmentPreviewUrl}
                          alt="Attachment preview"
                          className="h-full w-full rounded object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAttachmentClear}
                        disabled={isSubmitting}
                        className="h-7 border border-border bg-background text-xs text-foreground hover:bg-muted"
                      >
                        Remove
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
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
