"use client"

import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useRef, useState } from "react"

const MD_BREAKPOINT_PX = 768
/** この距離以上引いたら指を離したときに更新 */
const PULL_TRIGGER_PX = 72
const PULL_RESIST = 0.4
const PULL_CAP_PX = 112
const REFRESH_COOLDOWN_MS = 1200

type Props = { children: ReactNode }

/**
 * スマホ幅のみ: メインスクロールが最上部のときに下方向へ引くと `router.refresh()`（画面の再取得）。
 * PC（md 以上）では通常のスクロールのみ。
 */
export function MobilePullToRefreshMain({ children }: Props) {
  const router = useRouter()
  const mainRef = useRef<HTMLElement | null>(null)
  const [mobileLayout, setMobileLayout] = useState(false)
  const [pullVisual, setPullVisual] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const touchArmed = useRef(false)
  const touch0Y = useRef(0)
  const pullPxRef = useRef(0)
  const refreshingRef = useRef(false)
  const lastRefreshAt = useRef(0)

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`)
    const sync = () => setMobileLayout(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    const el = mainRef.current
    if (!el || !mobileLayout) {
      return
    }

    const resetPull = () => {
      touchArmed.current = false
      pullPxRef.current = 0
      setPullVisual(0)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) {
        return
      }
      if (Date.now() - lastRefreshAt.current < REFRESH_COOLDOWN_MS) {
        return
      }
      if (el.scrollTop > 1) {
        return
      }
      touchArmed.current = true
      touch0Y.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touchArmed.current || refreshingRef.current) {
        return
      }
      if (el.scrollTop > 1) {
        resetPull()
        return
      }
      const dy = e.touches[0].clientY - touch0Y.current
      if (dy <= 0) {
        if (pullPxRef.current > 0) {
          pullPxRef.current = 0
          setPullVisual(0)
        }
        return
      }
      e.preventDefault()
      const damped = Math.min(PULL_CAP_PX, dy * PULL_RESIST)
      pullPxRef.current = damped
      setPullVisual(damped)
    }

    const onTouchEnd = () => {
      if (!touchArmed.current) {
        return
      }
      const shouldRefresh = pullPxRef.current >= PULL_TRIGGER_PX
      resetPull()
      if (!shouldRefresh || refreshingRef.current) {
        return
      }
      lastRefreshAt.current = Date.now()
      setRefreshing(true)
      try {
        router.refresh()
      } finally {
        window.setTimeout(() => setRefreshing(false), 600)
      }
    }

    const onTouchCancel = () => {
      resetPull()
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd)
    el.addEventListener("touchcancel", onTouchCancel)

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchCancel)
    }
  }, [mobileLayout, router])

  const showHint = mobileLayout && (pullVisual > 10 || refreshing)
  const releaseHint = pullVisual >= PULL_TRIGGER_PX

  return (
    <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-contain">
      {showHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-sm">
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                <span>更新中…</span>
              </>
            ) : releaseHint ? (
              <span>離すと更新</span>
            ) : (
              <span>引き下げて更新</span>
            )}
          </div>
        </div>
      ) : null}
      <div
        className="flex min-h-full flex-col"
        style={
          mobileLayout && pullVisual > 0
            ? { transform: `translateY(${pullVisual}px)`, transition: "none" }
            : undefined
        }
      >
        {children}
      </div>
    </main>
  )
}
