"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { EmailOtpType } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import {
  buildSignupVerifiedLoginUrl,
  isLikelySignupEmailAlreadyVerifiedOnServer,
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
    const run = async () => {
      const supabase = getSupabaseBrowserClient()
      const url = new URL(window.location.href)
      const nextPath = sanitizeAuthNextPath(url.searchParams.get("next"))

      const oauthError = url.searchParams.get("error")?.trim()
      if (oauthError) {
        router.replace(buildLoginRedirectUrl("exchange_failed"))
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
        if (
          isSignupEmailConfirmationNextPath(nextPath) &&
          isLikelySignupEmailAlreadyVerifiedOnServer(error.message)
        ) {
          router.replace(buildSignupVerifiedLoginUrl())
          return
        }
        router.replace(buildLoginRedirectUrl(resolveFailureReasonFromMessage(error.message)))
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
        if (
          isSignupEmailConfirmationNextPath(nextPath) &&
          error.message &&
          isLikelySignupEmailAlreadyVerifiedOnServer(error.message)
        ) {
          router.replace(buildSignupVerifiedLoginUrl())
          return
        }
        router.replace(buildLoginRedirectUrl("otp_failed"))
        return
      }

      // ハッシュフラグメントのみ等: detectSessionInUrl で URL からセッション復元を試みる
      if (await tryRecoverExistingSession()) {
        await establishSessionAndRedirect()
        return
      }

      router.replace(buildLoginRedirectUrl("missing"))
    }

    void run().catch((e: unknown) => {
      console.error("[auth/callback]", e)
      setErrorMessage("認証処理中にエラーが発生しました。")
      try {
        const url = new URL(window.location.href)
        const nextPath = sanitizeAuthNextPath(url.searchParams.get("next"))
        if (isSignupEmailConfirmationNextPath(nextPath)) {
          router.replace(buildSignupVerifiedLoginUrl())
          return
        }
      } catch {
        /* fall through */
      }
      router.replace(buildLoginRedirectUrl("exchange_failed"))
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
