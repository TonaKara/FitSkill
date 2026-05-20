"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { getProfileAvatarUrl } from "@/lib/profile-avatar"

/**
 * ヘッダー / ユーザーメニュー / モバイルメニュー で参照するプロフィール要約。
 *
 * `displayName` は **トリム済みの DB 値** をそのまま返す。空文字／未設定の場合は `""` を返し、
 * 表示側（`user-menu.tsx`, `mobile-header-menu-drawer.tsx` 等）で locale 別のフォールバック
 * 文言 (`t("header.user")` 等) に置き換える。
 *
 * 旧実装ではこの層で `"ユーザー"` 固定のフォールバックを当てていたが、英語表示時にも JA が
 * 漏れる原因になっていたため、空値判定だけを行い、文言の解決は呼び出し側へ委譲する。
 */
export type ProfileSummary = {
  displayName: string
  avatarUrl: string | null
}

type HeaderAuthContextValue = {
  isAuthenticated: boolean
  isAuthLoading: boolean
  profileSummary: ProfileSummary | null
  profileLoading: boolean
}

const HeaderAuthContext = createContext<HeaderAuthContextValue | null>(null)

function applyProfileFromRow(
  row: { display_name: string | null; avatar_url: string | null } | null,
): ProfileSummary {
  const displayNameRaw = typeof row?.display_name === "string" ? row.display_name.trim() : ""
  return {
    displayName: displayNameRaw,
    avatarUrl: getProfileAvatarUrl(row?.avatar_url ?? null),
  }
}

export function HeaderAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const profileFetchUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadSessionAndProfile = async (session: Session | null) => {
      const user = session?.user ?? null
      if (!mounted) {
        return
      }

      setIsAuthenticated(Boolean(user))
      setIsAuthLoading(false)

      if (!user) {
        profileFetchUserIdRef.current = null
        setProfileSummary(null)
        setProfileLoading(false)
        return
      }

      const prevUid = profileFetchUserIdRef.current
      const userIdChanged = prevUid !== user.id
      profileFetchUserIdRef.current = user.id
      if (userIdChanged) {
        setProfileSummary(null)
        setProfileLoading(true)
      }

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle()

      if (!mounted) {
        return
      }
      setProfileLoading(false)
      setProfileSummary(
        applyProfileFromRow(data as { display_name: string | null; avatar_url: string | null } | null),
      )
    }

    void supabase.auth.getSession().then(({ data }) => {
      void loadSessionAndProfile(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadSessionAndProfile(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(
    () => ({
      isAuthenticated,
      isAuthLoading,
      profileSummary,
      profileLoading,
    }),
    [isAuthenticated, isAuthLoading, profileSummary, profileLoading],
  )

  return <HeaderAuthContext.Provider value={value}>{children}</HeaderAuthContext.Provider>
}

export function useHeaderAuth(): HeaderAuthContextValue {
  const context = useContext(HeaderAuthContext)
  if (!context) {
    throw new Error("useHeaderAuth must be used within HeaderAuthProvider")
  }
  return context
}
