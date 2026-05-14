"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { EmailOtpType } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import {
  buildSignupVerifiedLoginUrl,
  isSignupEmailConfirmationNextPath,
  sanitizeAuthNextPath,
} from "@/lib/auth-email-flow"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type FailureReason = "missing" | "session_context" | "exchange_failed" | "otp_failed"

function buildLoginRedirectUrl(reason: FailureReason): string {
  const params = new URLSearchParams({ error: "auth_callback", reason })
  return `/login?${params.toString()}`
}

function isLikelySessionContextError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("code verifier") ||
    normalized.includes("pkce") ||
    normalized.includes("both auth code and code verifier")
  )
}

function resolveFailureReasonFromMessage(message: string): FailureReason {
  return isLikelySessionContextError(message) ? "session_context" : "exchange_failed"
}

async function postNewUserDiscord(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}): Promise<void> {
  const displayName =
    typeof user.user_metadata?.display_name === "string" ? String(user.user_metadata.display_name).trim() : ""
  try {
    await fetch("/api/notifications/new-user-discord", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email ?? "",
        displayName,
      }),
    })
  } catch {
    // 通知失敗で認証完了フローを止めない
  }
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const nextPath = sanitizeAuthNextPath(url.searchParams.get("next"))
    /** 新規登録のメール確認リンクのみ。セッション化に失敗しても Supabase 側で確認済みのことが多いので常にログイン誘導へ統一する */
    const signupConfirmationFlow = isSignupEmailConfirmationNextPath(nextPath)

    const redirectLoginOrVerified = (reason: FailureReason) => {
      router.replace(signupConfirmationFlow ? buildSignupVerifiedLoginUrl() : buildLoginRedirectUrl(reason))
    }

    const run = async () => {
      const supabase = getSupabaseBrowserClient()

      const oauthError = url.searchParams.get("error")?.trim()
      if (oauthError) {
        redirectLoginOrVerified("exchange_failed")
        return
      }

      const establishSessionAndRedirect = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          await postNewUserDiscord(user)
        }
        router.replace(nextPath)
        router.refresh()
      }

      const tryRecoverExistingSession = async (): Promise<boolean> => {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        return Boolean(session?.user)
      }

      const code = url.searchParams.get("code")?.trim()
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          await establishSessionAndRedirect()
          return
        }
        if (await tryRecoverExistingSession()) {
          await establishSessionAndRedirect()
          return
        }
        redirectLoginOrVerified(resolveFailureReasonFromMessage(error.message))
        return
      }

      const tokenHash = url.searchParams.get("token_hash")?.trim()
      const type = url.searchParams.get("type")?.trim() as EmailOtpType | ""
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as EmailOtpType,
          token_hash: tokenHash,
        })
        if (!error) {
          await establishSessionAndRedirect()
          return
        }
        if (await tryRecoverExistingSession()) {
          await establishSessionAndRedirect()
          return
        }
        redirectLoginOrVerified("otp_failed")
        return
      }

      // ハッシュフラグメントのみ等: detectSessionInUrl で URL からセッション復元を試みる
      if (await tryRecoverExistingSession()) {
        await establishSessionAndRedirect()
        return
      }

      redirectLoginOrVerified("missing")
    }

    void run().catch((e: unknown) => {
      console.error("[auth/callback]", e)
      if (!signupConfirmationFlow) {
        setErrorMessage("認証処理中にエラーが発生しました。")
      }
      redirectLoginOrVerified("exchange_failed")
    })
  }, [router])

  if (errorMessage) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 bg-black px-4 text-center text-sm text-zinc-300">
        <p>{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-black px-4 text-zinc-200">
      <Loader2 className="h-8 w-8 animate-spin text-red-500" aria-hidden />
      <p className="text-sm">メール認証を確認しています…</p>
    </div>
  )
}
