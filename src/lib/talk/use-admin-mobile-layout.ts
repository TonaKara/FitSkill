"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

const MOBILE_ADMIN_MAX_WIDTH_PX = 767

/** Tailwind `md` 未満 = GritVib 管理画面のスマホレイアウト */
export function useGritvibAdminMobileLayout(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_ADMIN_MAX_WIDTH_PX}px)`)
    mq.addEventListener("change", onStoreChange)
    return () => mq.removeEventListener("change", onStoreChange)
  }, [])
  const getSnapshot = useCallback(
    () => window.matchMedia(`(max-width: ${MOBILE_ADMIN_MAX_WIDTH_PX}px)`).matches,
    [],
  )
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** ハイドレーション完了後のみ true（Realtime の二重購読を防ぐ）。 */
export function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
