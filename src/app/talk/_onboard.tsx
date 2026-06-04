"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { LegalFoot } from "@/talk/_legal-foot"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { safeClientLogError } from "@/lib/safe-client-log"
import {
  checkGritvibNicknameAvailabilityAction,
  completeGritvibOnboardingAction,
} from "@/talk/_auth-actions"
import {
  GRITVIB_NICKNAME_MAX_LENGTH,
  GRITVIB_NICKNAME_MIN_LENGTH,
  validateGritvibNickname,
} from "@/lib/talk/nickname-rules"
import { resolveGritvibPostAuthPath } from "@/lib/talk/post-auth-redirect"

/**
 * GritVib (人間チャットサービス) の初回ログイン後 onboard 画面。
 *
 * 役割:
 *   - メール確認後 (`/auth/callback?next=/talk/onboard`) または未登録の会員が初回ログインしたあとに着地する。
 *   - ここでニックネームを決め、`gritvib_chat_members` レコードを作成する。
 *   - 既に onboard 済みならチャットまたは管理画面へ直行する（管理者は管理画面）。
 *
 * 未ログイン状態でアクセスされた場合はログイン画面に誘導する。
 */

type OnboardPhase = "loading" | "manual" | "submitting" | "redirect"

export function OnboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])

  const [phase, setPhase] = useState<OnboardPhase>("loading")
  const [nickname, setNickname] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  /** 認証状態と会員登録済みかどうかで、ニックネーム入力またはリダイレクトに分岐する。 */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        router.replace("/talk/login")
        return
      }

      const { data: isMember } = await supabase.rpc("gritvib_chat_self_is_member")
      if (cancelled) return
      if (isMember) {
        setPhase("redirect")
        router.replace(await resolveGritvibPostAuthPath(supabase, user.id))
        return
      }

      setPhase("manual")
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phase === "submitting") return
    setErrorMessage(null)

    const validation = validateGritvibNickname(nickname)
    if (!validation.ok) {
      setErrorMessage(describeNicknameReason(validation.reason))
      return
    }

    setPhase("submitting")
    try {
      const availability = await checkGritvibNicknameAvailabilityAction(validation.value)
      if (!availability.ok) {
        setErrorMessage(describeNicknameReason(availability.reason))
        setPhase("manual")
        return
      }
      if (!availability.available) {
        setErrorMessage("このニックネームはすでに使われています。")
        setPhase("manual")
        return
      }

      const result = await completeGritvibOnboardingAction(validation.value)
      if (!result.ok) {
        if (result.reason === "nickname_taken") {
          setErrorMessage("このニックネームはすでに使われています。")
        } else if (result.reason === "already_onboarded") {
          const {
            data: { user: currentUser },
          } = await supabase.auth.getUser()
          if (currentUser) {
            router.replace(await resolveGritvibPostAuthPath(supabase, currentUser.id))
          } else {
            router.replace("/talk/login")
          }
          return
        } else if (result.reason === "unauthenticated") {
          router.replace("/talk/login")
          return
        } else {
          setErrorMessage(describeNicknameReason(result.reason))
        }
        setPhase("manual")
        return
      }
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      if (currentUser) {
        router.replace(await resolveGritvibPostAuthPath(supabase, currentUser.id))
      } else {
        router.replace("/talk/login")
      }
    } catch (err) {
      safeClientLogError("[talk/onboard] submit error")
      setErrorMessage("登録の完了に失敗しました。時間をおいて再度お試しください。")
      setPhase("manual")
    }
  }

  if (phase === "loading" || phase === "redirect") {
    return (
      <div className="flex min-h-[100svh] flex-col bg-white text-black">
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" aria-hidden />
          <p className="mt-4 text-sm text-zinc-600">読み込み中…</p>
        </main>
        <LegalFoot />
      </div>
    )
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-white text-black">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-zinc-500 hover:text-zinc-900"
            >
              GritVib
            </Link>
            <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
              ニックネームを決める
            </h1>
            <p className="mt-2 text-xs text-zinc-600 sm:text-sm">
              初回ログイン後に1回だけ設定します。あとから変更はできません。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <div>
              <label
                htmlFor="onboard-nickname"
                className="block text-sm font-medium text-black"
              >
                ニックネーム
              </label>
              <input
                id="onboard-nickname"
                type="text"
                autoComplete="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                disabled={phase === "submitting"}
                maxLength={GRITVIB_NICKNAME_MAX_LENGTH}
                placeholder={`${GRITVIB_NICKNAME_MIN_LENGTH}〜${GRITVIB_NICKNAME_MAX_LENGTH} 文字`}
                required
                className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:bg-zinc-50"
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={phase === "submitting"}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {phase === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  設定中…
                </>
              ) : (
                "はじめる"
              )}
            </button>
          </form>
        </div>
      </main>
      <LegalFoot />
    </div>
  )
}

function describeNicknameReason(
  reason:
    | "empty"
    | "too_short"
    | "too_long"
    | "invalid_chars"
    | "internal"
    | "already_onboarded"
    | "nickname_taken"
    | "unauthenticated",
): string {
  switch (reason) {
    case "empty":
      return "ニックネームを入力してください。"
    case "too_short":
      return `ニックネームは ${GRITVIB_NICKNAME_MIN_LENGTH} 文字以上で設定してください。`
    case "too_long":
      return `ニックネームは ${GRITVIB_NICKNAME_MAX_LENGTH} 文字以下で設定してください。`
    case "invalid_chars":
      return "ニックネームは英数字・日本語・ハイフン・アンダースコアのみ使えます。"
    case "nickname_taken":
      return "このニックネームはすでに使われています。"
    case "already_onboarded":
      return "すでに登録が完了しています。"
    case "unauthenticated":
      return "セッションが切れました。もう一度ログインしてください。"
    case "internal":
    default:
      return "登録の完了に失敗しました。時間をおいて再度お試しください。"
  }
}
