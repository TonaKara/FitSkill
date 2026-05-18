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
  const label = displayNameRaw.length > 0 ? displayNameRaw : "ユーザー"
  return {
    displayName: label,
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
