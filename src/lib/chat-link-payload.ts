/** messages.file_type 用。構造化リンク（Zoom / YouTube）を content に JSON で保存する。 */
export const CHAT_LINK_FILE_TYPE = "link" as const

/** content に YouTube の URL 文字列のみを保存する場合 */
export const CHAT_YOUTUBE_FILE_TYPE = "youtube" as const

export type ZoomLinkPayload = {
  kind: "zoom"
  meetingId: string
  password: string
  link: string
}

export type YoutubeLinkPayload = {
  kind: "youtube"
  url: string
}

export type LinkMessagePayload = ZoomLinkPayload | YoutubeLinkPayload

export function serializeLinkPayload(payload: LinkMessagePayload): string {
  return JSON.stringify(payload)
}

export function parseLinkMessageContent(content: string): LinkMessagePayload | null {
  try {
    const o = JSON.parse(content) as unknown
    if (!o || typeof o !== "object") {
      return null
    }
    const obj = o as Record<string, unknown>
    if (obj.kind === "zoom") {
      if (typeof obj.meetingId !== "string" || typeof obj.link !== "string") {
        return null
      }
      const meetingId = obj.meetingId.trim()
      const link = obj.link.trim()
      if (!meetingId || !link) {
        return null
      }
      return {
        kind: "zoom",
        meetingId,
        password: typeof obj.password === "string" ? obj.password : "",
        link,
      }
    }
    if (obj.kind === "youtube") {
      if (typeof obj.url !== "string") {
        return null
      }
      const url = obj.url.trim()
      if (!url) {
        return null
      }
      return { kind: "youtube", url }
    }
    return null
  } catch {
    return null
  }
}

/** YouTube の動画 ID を取り出す（埋め込み用）。取れなければ null。 */
export function extractYoutubeVideoId(input: string): string | null {
  const s = input.trim()
  if (!s) {
    return null
  }
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v")
      if (v && /^[\w-]{11}$/.test(v)) {
        return v
      }
      const parts = u.pathname.split("/").filter(Boolean)
      const embedI = parts.indexOf("embed")
      if (embedI !== -1 && parts[embedI + 1] && /^[\w-]{11}$/.test(parts[embedI + 1]!)) {
        return parts[embedI + 1]!
      }
      const shortsI = parts.indexOf("shorts")
      if (shortsI !== -1 && parts[shortsI + 1] && /^[\w-]{11}$/.test(parts[shortsI + 1]!)) {
        return parts[shortsI + 1]!
      }
    }
  } catch {
    if (/^[\w-]{11}$/.test(s)) {
      return s
    }
  }
  return null
}

/**
 * 本文が「YouTube の URL のみ」のときその URL を返す（リッチ表示用）。
 * 複数行や前後に文言がある場合は null。
 */
export function extractYoutubeUrlFromPlainContent(content: string): string | null {
  const t = content.trim()
  if (!t || /[\r\n]/.test(t)) {
    return null
  }
  if (!extractYoutubeVideoId(t)) {
    return null
  }
  if (/^https?:\/\//i.test(t)) {
    return t
  }
  if (/^[\w-]{11}$/.test(t)) {
    return `https://www.youtube.com/watch?v=${t}`
  }
  return null
}

/** file_type が youtube のとき、content を ReactPlayer に渡せる URL に正規化 */
export function normalizeYoutubeUrlForPlayer(content: string): string | null {
  const t = content.trim()
  if (!t) {
    return null
  }
  if (!extractYoutubeVideoId(t)) {
    return null
  }
  if (/^https?:\/\//i.test(t)) {
    return t
  }
  if (/^[\w-]{11}$/.test(t)) {
    return `https://www.youtube.com/watch?v=${t}`
  }
  return null
}
