"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFavoriteCountAndMine } from "@/lib/favorites"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

type SkillCardFavoriteProps = {
  skillId: string
}

export function SkillCardFavorite({ skillId }: SkillCardFavoriteProps) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  /** UI に表示しているのはこの count（お気に入り件数） */
  const [count, setCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    const { count: dbCount, favorited: isFav } = await getFavoriteCountAndMine(supabase, skillId)
    setCount(dbCount)
    setFavorited(isFav)
    setLoading(false)
  }, [supabase, skillId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "INITIAL_SESSION") {
        return
      }
      void load()
    })
    return () => subscription.unsubscribe()
  }, [supabase, load])

  useEffect(() => {
    const channel = supabase
      .channel(`skill-favorites:${skillId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "favorites",
          filter: `skill_id=eq.${skillId}`,
        },
        (payload: { eventType: string }) => {
          if (payload.eventType === "INSERT") {
            setCount((n) => n + 1)
          }
          if (payload.eventType === "DELETE") {
            setCount((n) => Math.max(0, n - 1))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, skillId])

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log("ボタンが押されました")
    console.log("現在のカウント:", count)

    if (loading || pending) {
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      const path = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/"
      router.push(`/login?redirect=${encodeURIComponent(path)}`)
      return
    }

    setPending(true)
    if (favorited) {
      const { error } = await supabase.from("favorites").delete().eq("skill_id", skillId).eq("user_id", user.id)
      if (!error) {
        setFavorited(false)
      }
    } else {
      const { error } = await supabase.from("favorites").insert({ skill_id: skillId, user_id: user.id })
      if (!error) {
        setFavorited(true)
      }
    }

    const { count: latestCount, favorited: latestFavorited } = await getFavoriteCountAndMine(supabase, skillId)
    setCount(latestCount)
    setFavorited(latestFavorited)

    setPending(false)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-3 top-3 h-auto min-w-8 gap-1 rounded-full bg-background/50 px-2 py-1.5 backdrop-blur-sm hover:bg-background/80 hover:text-primary"
      onClick={(e) => void handleClick(e)}
      disabled={loading || pending}
      aria-pressed={favorited}
      aria-label={favorited ? "お気に入りから外す" : "お気に入りに追加"}
    >
      <Heart className={`h-4 w-4 shrink-0 ${favorited ? "fill-primary text-primary" : ""}`} />
      <span className="text-xs font-medium tabular-nums leading-none text-foreground">{count}</span>
    </Button>
  )
}
