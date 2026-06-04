"use client"

import { ChangeEvent, FormEvent, useMemo, useState } from "react"
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationToast } from "@/components/ui/notification-toast"
import { toErrorNotice, type AppNotice } from "@/lib/notifications"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { Reveal } from "@/landing-preview/_reveal"

/**
 * /landing-preview の依頼フォームセクション。
 *
 * 既存の `/contact` と同じ `contact_submissions` テーブルに保存することで、
 * 運営側は管理画面 (/admin/contacts) からそのまま受信内容を確認できる。
 * `category` を "GritVibフィードバック依頼" 固定にして、他のお問い合わせと
 * 区別できるようにする。Discord 通知も既存ルートを叩いて流用する。
 *
 * - 認証は不要 (匿名の依頼を受け付ける想定)。
 * - 添付ファイルは現時点では受け付けない。必要になったら contact のように後付け可能。
 * - 送信成功時はフォーム内で「受付完了」表示に切り替え、ページ遷移はしない
 *   (LP に留まってもらい、他セクションも見てもらう動線を残したい)。
 */

const SUBJECT_MAX = 40
const CONTENT_MAX = 2000
const APP_NAME_MAX = 80
const APP_URL_MAX = 500
const FEEDBACK_CATEGORY = "GritVibフィードバック依頼"

type RequestFormState = {
  name: string
  email: string
  appName: string
  appUrl: string
  content: string
}

const DEFAULT_FORM: RequestFormState = {
  name: "",
  email: "",
  appName: "",
  appUrl: "",
  content: "",
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function RequestFormSection() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [form, setForm] = useState<RequestFormState>(DEFAULT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<AppNotice | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const canSubmit =
    !isSubmitting &&
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    isValidEmail(form.email.trim()) &&
    form.appName.trim().length > 0 &&
    form.content.trim().length > 0

  const handleChange =
    (field: keyof RequestFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value
      setForm((prev) => ({ ...prev, [field]: value }))
    }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setNotice(null)

    const name = form.name.trim()
    const email = form.email.trim()
    const appName = form.appName.trim().slice(0, APP_NAME_MAX)
    const appUrl = form.appUrl.trim().slice(0, APP_URL_MAX)
    const userContent = form.content.trim()

    if (!isValidEmail(email)) {
      setNotice({ variant: "error", message: "メールアドレスの形式が正しくありません。" })
      return
    }
    if (userContent.length > CONTENT_MAX) {
      setNotice({
        variant: "error",
        message: `本文は ${CONTENT_MAX} 文字以内で入力してください。`,
      })
      return
    }

    // 既存 contact_submissions の `subject` / `content` に収まるよう整形。
    // 「依頼アプリ: <name> / URL: <url>」を本文先頭に挟んで運営側でも一目で分かる形にする。
    const subject = `【依頼】${appName}`.slice(0, SUBJECT_MAX)
    const composedContent = [
      `■ 依頼アプリ: ${appName}`,
      appUrl.length > 0 ? `■ アプリ URL / 配布先: ${appUrl}` : null,
      "",
      "■ 依頼内容 / 見てほしいポイント:",
      userContent,
    ]
      .filter((line) => line !== null)
      .join("\n")
      .slice(0, CONTENT_MAX)

    setIsSubmitting(true)
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      const submitterProfileId = authUser?.id ?? null

      const { error: insertError } = await supabase.from("contact_submissions").insert({
        name,
        email,
        category: FEEDBACK_CATEGORY,
        subject,
        transaction_id: null,
        content: composedContent,
        attachment_path: null,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      if (insertError) {
        throw insertError
      }

      // Discord 通知 (失敗しても本処理は成功扱い)。
      try {
        await fetch("/api/notifications/contact-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            category: FEEDBACK_CATEGORY,
            subject,
            submitter_profile_id: submitterProfileId,
          }),
          keepalive: true,
        })
      } catch {
        /* Discord 失敗はサイレント */
      }

      setForm(DEFAULT_FORM)
      setSubmitted(true)
    } catch (error) {
      setNotice(
        toErrorNotice(error, false, {
          unknownErrorMessage: "送信に失敗しました。しばらくしてからお試しください。",
        }),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section
      id="request"
      className="relative overflow-hidden bg-[#08080a] py-28 text-zinc-100 md:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(230,74,25,0.22),_transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_bottom,_rgba(230,74,25,0.16),_transparent_70%)]"
      />

      <div className="relative mx-auto w-full max-w-2xl px-5 sm:px-6 md:px-8">
        {notice ? (
          <NotificationToast notice={notice} onClose={() => setNotice(null)} />
        ) : null}

        <Reveal>
          <div className="text-center">
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#e64a19]/40 bg-[#e64a19]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb796] sm:text-xs sm:tracking-[0.22em]">
              Request
            </span>
            <h2 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
              さっそく、依頼してみる。
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-zinc-300 md:text-base">
              下のフォームから 1 分ほどで送れます。受領後 1 営業日以内にメールでお返事します。
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-12 rounded-3xl border border-zinc-800 bg-[#13131a]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur md:mt-14 md:p-10">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col items-center gap-4 py-6 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e64a19]/15 text-[#ffb796]">
                  <CheckCircle2 className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="text-xl font-bold text-white md:text-2xl">受け付けました</h3>
                <p className="max-w-md text-pretty text-sm leading-relaxed text-zinc-300 md:text-base">
                  ありがとうございます。1 営業日以内にメールでご連絡します。
                  <br />
                  続けて別のアプリを依頼いただくこともできます。
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-full border border-zinc-700 bg-white/5 px-5 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-white/10"
                >
                  もう 1 件依頼する
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="lp-name"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100"
                    >
                      お名前
                      <span className="text-[11px] font-medium text-[#ffb796]">必須</span>
                    </label>
                    <Input
                      id="lp-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={handleChange("name")}
                      className="border-zinc-700 bg-[#0c0c10] text-white placeholder:text-zinc-500 focus-visible:ring-[#e64a19]"
                      placeholder="山田 太郎"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="lp-email"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100"
                    >
                      メールアドレス
                      <span className="text-[11px] font-medium text-[#ffb796]">必須</span>
                    </label>
                    <Input
                      id="lp-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange("email")}
                      className="border-zinc-700 bg-[#0c0c10] text-white placeholder:text-zinc-500 focus-visible:ring-[#e64a19]"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="lp-app-name"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100"
                  >
                    アプリ名 / プロダクト名
                    <span className="text-[11px] font-medium text-[#ffb796]">必須</span>
                  </label>
                  <Input
                    id="lp-app-name"
                    type="text"
                    required
                    maxLength={APP_NAME_MAX}
                    value={form.appName}
                    onChange={handleChange("appName")}
                    className="border-zinc-700 bg-[#0c0c10] text-white placeholder:text-zinc-500 focus-visible:ring-[#e64a19]"
                    placeholder="MyAwesomeApp"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="lp-app-url"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100"
                  >
                    アプリ URL / 配布先
                    <span className="text-[11px] font-medium text-zinc-400">任意</span>
                  </label>
                  <Input
                    id="lp-app-url"
                    type="url"
                    maxLength={APP_URL_MAX}
                    value={form.appUrl}
                    onChange={handleChange("appUrl")}
                    className="border-zinc-700 bg-[#0c0c10] text-white placeholder:text-zinc-500 focus-visible:ring-[#e64a19]"
                    placeholder="https://apps.apple.com/... または https://example.com"
                  />
                  <p className="text-xs leading-relaxed text-zinc-500">
                    TestFlight の招待リンクや、限定配布の URL でも構いません。
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="lp-content"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-100"
                  >
                    見てほしいポイント / 依頼内容
                    <span className="text-[11px] font-medium text-[#ffb796]">必須</span>
                  </label>
                  <textarea
                    id="lp-content"
                    required
                    maxLength={CONTENT_MAX}
                    value={form.content}
                    onChange={handleChange("content")}
                    rows={6}
                    placeholder="例: 新規登録〜初回チュートリアルの体験について、特に詰まりそうな箇所を見てほしいです。"
                    className="w-full rounded-md border border-zinc-700 bg-[#0c0c10] px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#e64a19]"
                  />
                  <p className="text-right text-xs text-zinc-500">
                    {form.content.length} / {CONTENT_MAX}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-12 w-full rounded-full bg-[#e64a19] text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(230,74,25,0.7)] transition-all hover:bg-[#ff5a25] hover:shadow-[0_18px_60px_-10px_rgba(230,74,25,0.8)] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    "依頼を送る"
                  )}
                </Button>

                <p className="text-center text-xs text-zinc-500">
                  送信内容は運営側の問い合わせ管理画面に保存されます。
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
