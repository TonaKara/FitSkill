"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { TalkBrandHeader } from "@/talk/_brand-header"
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
import { useTranslations } from "@/lib/i18n/useI18n"

type OnboardPhase = "loading" | "manual" | "submitting" | "redirect"

export function OnboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const t = useTranslations("talk.onboard")
  const tCommon = useTranslations("talk.common")

  const [phase, setPhase] = useState<OnboardPhase>("loading")
  const [nickname, setNickname] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      setErrorMessage(describeNicknameReason(validation.reason, t))
      return
    }

    setPhase("submitting")
    try {
      const availability = await checkGritvibNicknameAvailabilityAction(validation.value)
      if (!availability.ok) {
        setErrorMessage(describeNicknameReason(availability.reason, t))
        setPhase("manual")
        return
      }
      if (!availability.available) {
        setErrorMessage(t("errorNicknameTaken"))
        setPhase("manual")
        return
      }

      const result = await completeGritvibOnboardingAction(validation.value)
      if (!result.ok) {
        if (result.reason === "nickname_taken") {
          setErrorMessage(t("errorNicknameTaken"))
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
          setErrorMessage(describeNicknameReason(result.reason, t))
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
      setErrorMessage(t("errorCompleteFailed"))
      setPhase("manual")
    }
  }

  if (phase === "loading" || phase === "redirect") {
    return (
      <div className="flex min-h-[100svh] flex-col bg-white text-black">
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" aria-hidden />
          <p className="mt-4 text-sm text-zinc-600">{tCommon("loading")}</p>
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
            <TalkBrandHeader />
            <h1 className="mt-6 text-2xl font-medium tracking-tight md:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 text-xs text-zinc-600 sm:text-sm">
              {t("description")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
            <div>
              <label
                htmlFor="onboard-nickname"
                className="block text-sm font-medium text-black"
              >
                {tCommon("nickname")}
              </label>
              <input
                id="onboard-nickname"
                type="text"
                autoComplete="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                disabled={phase === "submitting"}
                maxLength={GRITVIB_NICKNAME_MAX_LENGTH}
                placeholder={t("nicknamePlaceholder", {
                  min: GRITVIB_NICKNAME_MIN_LENGTH,
                  max: GRITVIB_NICKNAME_MAX_LENGTH,
                })}
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
                  {t("submitting")}
                </>
              ) : (
                t("getStarted")
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
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (reason) {
    case "empty":
      return t("errorEmpty")
    case "too_short":
      return t("errorTooShort", { min: GRITVIB_NICKNAME_MIN_LENGTH })
    case "too_long":
      return t("errorTooLong", { max: GRITVIB_NICKNAME_MAX_LENGTH })
    case "invalid_chars":
      return t("errorInvalidChars")
    case "nickname_taken":
      return t("errorNicknameTaken")
    case "already_onboarded":
      return t("errorAlreadyOnboarded")
    case "unauthenticated":
      return t("errorUnauthenticated")
    case "internal":
    default:
      return t("errorCompleteFailed")
  }
}
