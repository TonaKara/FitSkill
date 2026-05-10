"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { countUnreadNotifications } from "@/lib/transaction-notifications"
import { GeneralNotificationsList } from "@/components/GeneralNotificationsList"
import { cn } from "@/lib/utils"

type NotifTab = "ops" | "general"

export function NotificationBell() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotifTab>("general")
  const [unread, setUnread] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUserId(session?.user?.id ?? null)
    })
    void supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUserId(data.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnread(0)
      return
    }
    const c = await countUnreadNotifications(supabase, userId)
    setUnread(c)
  }, [supabase, userId])

  useEffect(() => {
    void refreshUnread()
  }, [refreshUnread])

  useEffect(() => {
    if (open && userId) {
      void refreshUnread()
    }
  }, [open, userId, refreshUnread])

  useEffect(() => {
    if (!userId) {
      return
    }
    const ownChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          void refreshUnread()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ownChannel)
    }
  }, [supabase, userId, refreshUnread])

  useEffect(() => {
    if (!open) {
      return
    }
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const onBellClick = () => {
    if (!userId) {
      router.push("/login")
      return
    }
    setOpen((o) => !o)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative hover:bg-secondary"
        onClick={onBellClick}
        aria-expanded={open}
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {userId && unread > 0 ? (
          <>
            <span
              className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent-color)] ring-2 ring-background"
              aria-hidden
            />
            <span className="sr-only">{`未読${unread}件`}</span>
          </>
        ) : null}
      </Button>
      {open && userId ? (
        <div
          className="absolute right-0 top-full z-[100] mt-2 w-[min(100vw-2rem,20rem)] rounded-lg border border-border bg-background shadow-xl"
          role="dialog"
          aria-label="通知"
        >
          <div className="flex border-b border-border text-sm">
            <button
              type="button"
              onClick={() => setTab("ops")}
              className={cn(
                "flex-1 py-2.5 text-center font-medium transition-colors",
                tab === "ops" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              運営より
            </button>
            <button
              type="button"
              onClick={() => setTab("general")}
              className={cn(
                "flex-1 py-2.5 text-center font-medium transition-colors",
                tab === "general" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              一般
            </button>
          </div>
          <div className="py-1">
            {tab === "ops" ? (
              <GeneralNotificationsList
                key={`${userId}-ops`}
                userId={userId}
                adminOrigin
                onRead={() => void refreshUnread()}
              />
            ) : (
              <GeneralNotificationsList
                key={`${userId}-general`}
                userId={userId}
                adminOrigin={false}
                onRead={() => void refreshUnread()}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
