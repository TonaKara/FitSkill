"use client"

import { usePathname } from "next/navigation"
import { useEffect } from "react"

const CONSOLE_METHODS: Array<keyof Console> = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "table",
]

const originalConsoleMethods = new Map<keyof Console, Console[keyof Console]>()

function muteConsole() {
  for (const method of CONSOLE_METHODS) {
    if (!originalConsoleMethods.has(method)) {
      originalConsoleMethods.set(method, console[method])
    }
    ;(console as any)[method] = () => {}
  }
}

function restoreConsole() {
  for (const method of CONSOLE_METHODS) {
    const original = originalConsoleMethods.get(method)
    if (original) {
      ;(console as any)[method] = original
    }
  }
}

export function ConsoleGuard() {
  const pathname = usePathname()

  useEffect(() => {
    const isAdminRoute = pathname?.startsWith("/admin") ?? false
    if (isAdminRoute) {
      restoreConsole()
      return
    }

    muteConsole()
    return () => {
      if (isAdminRoute) {
        restoreConsole()
      }
    }
  }, [pathname])

  return null
}
