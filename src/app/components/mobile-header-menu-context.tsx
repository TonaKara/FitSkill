"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

type MobileHeaderMenuContextValue = {
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
}

const MobileHeaderMenuContext = createContext<MobileHeaderMenuContextValue | null>(null)

export function MobileHeaderMenuProvider({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false)
  const value = useMemo(
    () => ({ isMobileMenuOpen, setMobileMenuOpen }),
    [isMobileMenuOpen],
  )
  return <MobileHeaderMenuContext.Provider value={value}>{children}</MobileHeaderMenuContext.Provider>
}

export function useMobileHeaderMenu() {
  const ctx = useContext(MobileHeaderMenuContext)
  if (!ctx) {
    throw new Error("useMobileHeaderMenu must be used within MobileHeaderMenuProvider")
  }
  return ctx
}
