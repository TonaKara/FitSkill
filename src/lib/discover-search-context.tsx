"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

type DiscoverSearchContextValue = {
  keyword: string
  setKeyword: (value: string) => void
}

const DiscoverSearchContext = createContext<DiscoverSearchContextValue | null>(null)

export function DiscoverSearchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [keyword, setKeyword] = useState("")

  useEffect(() => {
    if (!pathname.startsWith("/discover")) {
      setKeyword("")
    }
  }, [pathname])

  const value = useMemo(() => ({ keyword, setKeyword }), [keyword])

  return <DiscoverSearchContext.Provider value={value}>{children}</DiscoverSearchContext.Provider>
}

export function useDiscoverSearch(): DiscoverSearchContextValue | null {
  return useContext(DiscoverSearchContext)
}
