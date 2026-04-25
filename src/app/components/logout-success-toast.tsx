"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NotificationToast } from "@/components/ui/notification-toast"
import { toSuccessNotice, type AppNotice } from "@/lib/notifications"

const LOGOUT_QUERY = "logout"
const LOGOUT_QUERY_VALUE = "success"

function LogoutSuccessToastInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [notice, setNotice] = useState<AppNotice | null>(null)

  useEffect(() => {
    if (searchParams.get(LOGOUT_QUERY) !== LOGOUT_QUERY_VALUE) {
      return
    }

    setNotice(toSuccessNotice("ログアウトしました"))
    router.replace("/", { scroll: false })
  }, [searchParams, router])

  if (!notice) {
    return null
  }

  return <NotificationToast notice={notice} onClose={() => setNotice(null)} />
}

export function LogoutSuccessToast() {
  return (
    <Suspense fallback={null}>
      <LogoutSuccessToastInner />
    </Suspense>
  )
}

export function getLogoutSuccessHref() {
  const params = new URLSearchParams()
  params.set(LOGOUT_QUERY, LOGOUT_QUERY_VALUE)
  return `/?${params.toString()}`
}
