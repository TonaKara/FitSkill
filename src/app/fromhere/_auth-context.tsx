"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, SupabaseClient, User } from "@supabase/supabase-js"

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { LoginStreakBadgeId } from "@/fromhere/_login-streak"

export type FromHereProfile = {
  id: string
  handle: string
  display_name: string
  bio: string | null
  /**
   * 表示用アバター URL。
   *
   * 仕様（2026-05 再改訂）:
   * - 正本は `newvibes_profiles.avatar_url`。
   * - 本体 `profiles.avatar_url` は参照のみのフォールバック。
   * - 旧 `newvibes-avatars` バケットの `avatar_path` も互換のため読み取りはサポート。
   */
  avatar_url: string | null
  /** 互換用に残しているが、新規書き込みは行わない */
  avatar_path: string | null
}

/**
 * 連続ログイン日数の簡易サマリー。
 * - mount 後に `/api/fromhere/login-streak/touch` を呼び、結果を保持する。
 * - 未ログインまたは初回 fetch 前は null。
 */
export type FromHereStreak = {
  currentStreak: number
  longestStreak: number
  currentBadge: LoginStreakBadgeId | null
}

type FromHereAuthState = {
  /** 初回 getUser / プロフィール取得が終わるまで true */
  loading: boolean
  user: User | null
  session: Session | null
  /** newvibes_profiles の自分の行。未作成（onboarding 未完了）なら null */
  profile: FromHereProfile | null
  /** 連続ログインバッジ。未認証なら null */
  streak: FromHereStreak | null
  /**
   * 本体 `profiles.is_admin = true` のユーザーかどうか。
   * - 未ログイン / 未取得 / 通常ユーザーは false。
   * - 管理者専用 UI（運営レビュー管理、ヘッダーの一部ナビなど）の表示制御に使う。
   * - 真の権限ガードは Server Action / RLS 側で行うため、これはあくまで UI 用ヒント。
   */
  isAdmin: boolean
  signOut: () => Promise<void>
  /** プロフィール作成や更新の直後にコンテキストへ反映させる */
  refreshProfile: () => Promise<void>
}

const FromHereAuthContext = createContext<FromHereAuthState | null>(null)

/**
 * モジュールレベルの fetchProfile。
 *
 * - `select("*")` でまず全カラム取得（カラム名のミスマッチ耐性）。
 * - 取得失敗時は dev コンソールに詳細をログ出力する。
 * - `avatar_url` が空なら本体 `profiles.avatar_url` をフォールバック参照。
 */
async function fetchProfile(
  supabase: SupabaseClient,
  uid: string,
): Promise<FromHereProfile | null> {
  const profileRes = await supabase
    .from("newvibes_profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle()
  if (profileRes.error) {
    if (typeof console !== "undefined") {
      console.warn(
        "[FromHereAuth] newvibes_profiles fetch failed",
        profileRes.error.message ?? profileRes.error,
      )
    }
    return null
  }
  if (!profileRes.data) {
    if (typeof console !== "undefined") {
      console.info("[FromHereAuth] newvibes_profiles row not found for uid=", uid)
    }
    return null
  }
  const data = profileRes.data as Record<string, unknown>

  const id = typeof data.id === "string" ? data.id : ""
  const handle = typeof data.handle === "string" ? data.handle : ""
  const displayName = typeof data.display_name === "string" ? data.display_name : ""
  const bio = typeof data.bio === "string" ? data.bio : null
  let avatarUrl = typeof data.avatar_url === "string" ? data.avatar_url : null
  const avatarPath = typeof data.avatar_path === "string" ? data.avatar_path : null

  if (!avatarUrl || avatarUrl.trim().length === 0) {
    const mainRes = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", uid)
      .maybeSingle()
    if (mainRes && !mainRes.error && mainRes.data) {
      const main = (mainRes.data as { avatar_url: unknown }).avatar_url
      if (typeof main === "string" && main.trim().length > 0) {
        avatarUrl = main
      }
    }
  }
  return {
    id,
    handle,
    display_name: displayName,
    bio,
    avatar_url: avatarUrl,
    avatar_path: avatarPath,
  }
}

/**
 * 本体 `profiles.is_admin` を見て管理者かどうかを判定する。
 * - 取得失敗時は false を返す（権限の真の判定はサーバー側で行うため、UI ヒントとしては安全側に倒す）。
 */
async function fetchIsAdmin(supabase: SupabaseClient, uid: string): Promise<boolean> {
  const res = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", uid)
    .maybeSingle()
  if (res.error) {
    return false
  }
  const data = res.data as { is_admin?: unknown } | null
  return Boolean(data?.is_admin)
}

/** SSR から渡せる初期状態。再ハイドレーション時のラグを消すため、layout が直接埋め込む。 */
export type FromHereAuthInitial = {
  /** SSR 側で `supabase.auth.getUser()` した結果。匿名なら null。 */
  user: Pick<User, "id" | "email"> | null
  /** SSR 側で取得した自分のプロフィール。未作成なら null。 */
  profile: FromHereProfile | null
  /** SSR 側で取得した本体 `profiles.is_admin`。未ログインや未取得は false。 */
  isAdmin?: boolean
}

/**
 * /fromhere 配下の認証コンテキストプロバイダ。
 *
 * - GritVib 本体と同じ Supabase Auth セッションを共有しつつ、
 *   FromHere 専用の `newvibes_profiles` 取得をフックする。
 * - SSR で取得した `initial` を初期 state に流し込み、初回描画から
 *   ヘッダー右の表示名 / アバターを正しく出せるようにする。
 * - クライアントマウント後は `onAuthStateChange` で再同期する。
 */
export function FromHereAuthProvider({
  children,
  initial,
}: {
  children: React.ReactNode
  initial?: FromHereAuthInitial
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  /**
   * SSR で `user` が判明していればクライアント側の初期ロードは即終了扱いにできる。
   * SSR 由来の state があれば `loading=false` で開始し、初回描画から正しい UI を出す。
   */
  const [loading, setLoading] = useState(!initial)
  const [user, setUser] = useState<User | null>(
    initial?.user ? (initial.user as User) : null,
  )
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<FromHereProfile | null>(initial?.profile ?? null)
  const [streak, setStreak] = useState<FromHereStreak | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(Boolean(initial?.isAdmin))

  const refreshProfile = async () => {
    if (!user?.id) {
      setProfile(null)
      setIsAdmin(false)
      return
    }
    const next = await fetchProfile(supabase, user.id)
    setProfile(next)
    const nextAdmin = await fetchIsAdmin(supabase, user.id)
    setIsAdmin(nextAdmin)
  }

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const currentSession = sessionData.session ?? null
      const currentUser = currentSession?.user ?? null
      if (cancelled) {
        return
      }
      setSession(currentSession)
      setUser(currentUser)
      if (currentUser?.id) {
        const [nextProfile, nextAdmin] = await Promise.all([
          fetchProfile(supabase, currentUser.id),
          fetchIsAdmin(supabase, currentUser.id),
        ])
        if (!cancelled) {
          setProfile(nextProfile)
          setIsAdmin(nextAdmin)
        }
      } else {
        setProfile(null)
        setIsAdmin(false)
      }
      if (!cancelled) {
        setLoading(false)
      }
    }

    void init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      const nextUser = nextSession?.user ?? null
      setUser(nextUser)
      if (!nextUser?.id) {
        setProfile(null)
        setStreak(null)
        setIsAdmin(false)
        return
      }
      void fetchProfile(supabase, nextUser.id).then((next) => {
        setProfile(next)
      })
      void fetchIsAdmin(supabase, nextUser.id).then((next) => {
        setIsAdmin(next)
      })
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  /**
   * ユーザー切替時に連続ログイン日数を取得する。
   *
   * - `/api/fromhere/login-streak/touch` は同日 2 回目以降の呼び出しを no-op で返すため、
   *   ページ遷移のたびに呼んでも DB 書き込みは増えない。
   * - effect 内で同期 `setStreak(null)` は React Compiler に弾かれるため、
   *   非同期コールバック内でリセット → fetch する流れにしている。
   */
  useEffect(() => {
    if (!user?.id) {
      return
    }
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      setStreak(null)
      try {
        const res = await fetch("/api/fromhere/login-streak/touch", {
          method: "POST",
          credentials: "same-origin",
        })
        if (!res.ok) {
          return
        }
        const json = (await res.json().catch(() => null)) as
          | {
              currentStreak: number
              longestStreak: number
              currentBadge: LoginStreakBadgeId | null
            }
          | null
        if (!cancelled && json) {
          setStreak({
            currentStreak: json.currentStreak ?? 0,
            longestStreak: json.longestStreak ?? 0,
            currentBadge: json.currentBadge ?? null,
          })
        }
      } catch {
        /* 失敗時はバッジを出さないだけ */
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setStreak(null)
    setIsAdmin(false)
  }

  const value: FromHereAuthState = {
    loading,
    user,
    session,
    profile,
    streak,
    isAdmin,
    signOut,
    refreshProfile,
  }

  return <FromHereAuthContext.Provider value={value}>{children}</FromHereAuthContext.Provider>
}

export function useFromHereAuth(): FromHereAuthState {
  const ctx = useContext(FromHereAuthContext)
  if (!ctx) {
    throw new Error("useFromHereAuth must be used within <FromHereAuthProvider>")
  }
  return ctx
}
