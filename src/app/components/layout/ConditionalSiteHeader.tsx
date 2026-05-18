"use client"

import { usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { useDiscoverSearch } from "@/lib/discover-search-context"
import { shouldShowSiteHeader } from "@/lib/site-header-routes"

export function ConditionalSiteHeader() {
  const pathname = usePathname()
  const discoverSearch = useDiscoverSearch()
  const onDiscover = pathname.startsWith("/discover")

  if (!shouldShowSiteHeader(pathname)) {
    return null
  }

  return (
    <Header
      fixed
      searchKeyword={onDiscover && discoverSearch ? discoverSearch.keyword : undefined}
      onSearchKeywordChange={onDiscover && discoverSearch ? discoverSearch.setKeyword : undefined}
    />
  )
}
