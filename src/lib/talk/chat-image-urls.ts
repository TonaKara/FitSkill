"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeGritvibChatImagePath } from "@/lib/talk/chat-image-path"
import { safeClientLogError } from "@/lib/safe-client-log"
import { signGritvibChatImagePathsAction } from "@/lib/talk/sign-chat-image-paths-action"

const SIGNED_URL_BATCH_SIZE = 20
const RETRY_DELAY_MS = 2000
const MAX_RETRIES_PER_PATH = 2

type SignedEntry = { path: string; url: string }

async function signPathsViaServer(paths: string[]): Promise<SignedEntry[]> {
  const normalized = paths.map((p) => normalizeGritvibChatImagePath(p))
  const result = await signGritvibChatImagePathsAction(normalized)
  if (!result.ok) {
    safeClientLogError("[talk/chat-images] sign action failed")
    return []
  }
  return Object.entries(result.urls).map(([path, url]) => ({ path, url }))
}

/**
 * チャット画像の signed URL を path 単位でキャッシュし、重複リクエストを防ぐ。
 */
export function useGritvibChatImageUrls() {
  const [urlByPath, setUrlByPath] = useState<Record<string, string>>({})
  const urlByPathRef = useRef(urlByPath)
  urlByPathRef.current = urlByPath

  const inflightRef = useRef<Set<string>>(new Set())
  const retryCountRef = useRef<Map<string, number>>(new Map())

  const commitUrls = useCallback((entries: SignedEntry[]) => {
    if (entries.length === 0) return
    setUrlByPath((prev) => {
      const next = { ...prev }
      let changed = false
      for (const { path, url } of entries) {
        if (!path || !url || next[path] === url) continue
        next[path] = url
        changed = true
      }
      return changed ? next : prev
    })
  }, [])

  const fetchPaths = useCallback(
    async (paths: string[]) => {
      const normalized = paths
        .filter(Boolean)
        .map((p) => normalizeGritvibChatImagePath(p))
      const unique = [...new Set(normalized)].filter(
        (p) => !urlByPathRef.current[p] && !inflightRef.current.has(p),
      )
      if (unique.length === 0) return

      for (const p of unique) inflightRef.current.add(p)

      try {
        const signedPaths = new Set<string>()
        for (let i = 0; i < unique.length; i += SIGNED_URL_BATCH_SIZE) {
          const batch = unique.slice(i, i + SIGNED_URL_BATCH_SIZE)
          const entries = await signPathsViaServer(batch)
          commitUrls(entries)
          for (const { path } of entries) signedPaths.add(path)
        }

        const missing = unique.filter((p) => !signedPaths.has(p) && !urlByPathRef.current[p])
        if (missing.length > 0) {
          const toRetry: string[] = []
          for (const p of missing) {
            const tries = retryCountRef.current.get(p) ?? 0
            if (tries < MAX_RETRIES_PER_PATH) {
              retryCountRef.current.set(p, tries + 1)
              toRetry.push(p)
            }
          }
          if (toRetry.length > 0) {
            window.setTimeout(() => {
              void fetchPaths(toRetry)
            }, RETRY_DELAY_MS)
          }
        } else {
          for (const p of unique) retryCountRef.current.delete(p)
        }
      } finally {
        for (const p of unique) inflightRef.current.delete(p)
      }
    },
    [commitUrls],
  )

  const preloadFromMessages = useCallback(
    (imagePaths: Array<string | null | undefined>) => {
      void fetchPaths(imagePaths.filter((p): p is string => Boolean(p)))
    },
    [fetchPaths],
  )

  const getImageUrl = useCallback(
    (path: string | null | undefined) => {
      if (!path) return undefined
      return urlByPath[normalizeGritvibChatImagePath(path)]
    },
    [urlByPath],
  )

  return { getImageUrl, preloadFromMessages }
}

/** メッセージに含まれる imagePath のうち、未取得のものだけ signed URL を取りに行く。 */
export function usePreloadGritvibChatImages(
  messages: Array<{ imagePath: string | null }>,
  preloadFromMessages: (paths: Array<string | null | undefined>) => void,
) {
  useEffect(() => {
    const paths = messages.map((m) => m.imagePath).filter(Boolean) as string[]
    if (paths.length === 0) return
    preloadFromMessages(paths)
  }, [messages, preloadFromMessages])
}
