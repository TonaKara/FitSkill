/** 取引チャット添付ファイルの検証・メタデータ・表示用ユーティリティ */

export const CHAT_MEDIA_BUCKET = "chat-media" as const

/** 1ファイルあたりの上限（50MB） */
export const MAX_CHAT_FILE_BYTES = 50 * 1024 * 1024

export const CHAT_FILE_META_PREFIX = "__CHAT_FILE__:"

export type ChatFileKind = "image" | "video" | "file"

export type ChatFileMeta = {
  name: string
  size: number
}

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "vbs",
  "vbe",
  "js",
  "jse",
  "ws",
  "wsf",
  "wsh",
  "msi",
  "msp",
  "apk",
  "app",
  "deb",
  "dmg",
  "pkg",
  "rpm",
  "run",
  "bin",
  "dll",
  "so",
  "hta",
  "inf",
  "reg",
  "ps1",
  "psm1",
  "cpl",
  "msc",
  "jar",
  "vb",
  "gadget",
  "lnk",
])

const BLOCKED_MIME_SNIPPETS = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
  "application/x-sh",
  "application/x-bat",
  "application/hta",
  "application/java-archive",
]

/** file input の accept（主要ドキュメント + 画像・動画） */
export const CHAT_FILE_INPUT_ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.zip,.rtf,.odt,.ods,.odp,.pages,.numbers,.key,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip"

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
}

export function formatChatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—"
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function extensionFromMime(mime: string, fallback: string): string {
  const normalized = mime.trim().toLowerCase()
  if (MIME_TO_EXT[normalized]) {
    return MIME_TO_EXT[normalized]
  }
  const sub = normalized.split("/")[1]
  if (sub && /^[a-z0-9.+-]+$/i.test(sub)) {
    return sub.replace("vnd.", "").slice(0, 16)
  }
  return fallback.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "bin"
}

export function sanitizeChatStorageFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "file"
  return base.replace(/[^a-zA-Z0-9._\u3000-\u9fff-]/g, "_").slice(0, 120)
}

export function fileExtension(fileName: string): string {
  const parts = fileName.split(".")
  if (parts.length < 2) {
    return ""
  }
  return (parts.pop() ?? "").toLowerCase()
}

export function isBlockedChatAttachment(file: File): boolean {
  const ext = fileExtension(file.name)
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return true
  }
  const mime = file.type.trim().toLowerCase()
  if (!mime) {
    return false
  }
  return BLOCKED_MIME_SNIPPETS.some((snippet) => mime.includes(snippet))
}

export function classifyChatFile(file: File): ChatFileKind | null {
  if (isBlockedChatAttachment(file)) {
    return null
  }
  const mime = file.type.trim().toLowerCase()
  if (mime.startsWith("image/")) {
    return "image"
  }
  if (mime.startsWith("video/")) {
    return "video"
  }
  if (mime.startsWith("audio/")) {
    return null
  }
  return "file"
}

export type ChatAttachmentValidationResult =
  | { ok: true; kind: ChatFileKind }
  | { ok: false; error: string }

export function validateChatAttachmentFile(file: File): ChatAttachmentValidationResult {
  if (file.size > MAX_CHAT_FILE_BYTES) {
    return { ok: false, error: "ファイルサイズは50MB以下にしてください。" }
  }
  if (isBlockedChatAttachment(file)) {
    return {
      ok: false,
      error: "セキュリティのため、この形式のファイルは送信できません。",
    }
  }
  const kind = classifyChatFile(file)
  if (!kind) {
    return {
      ok: false,
      error: "このファイル形式には対応していません。画像・動画・PDF・Office・テキスト等を選択してください。",
    }
  }
  return { ok: true, kind }
}

export function storedFileTypeForUpload(file: File, kind: ChatFileKind): string {
  if (kind === "image") {
    return "image"
  }
  if (kind === "video") {
    return "video"
  }
  return file.type.trim() || "application/octet-stream"
}

export function isMessageVideoType(t: string | null | undefined): boolean {
  return t === "video" || (typeof t === "string" && t.startsWith("video/"))
}

export function isMessageImageType(t: string | null | undefined): boolean {
  return t === "image" || (typeof t === "string" && t.startsWith("image/"))
}

export function isMessageGenericAttachmentType(
  fileType: string | null | undefined,
  hasFileUrl: boolean,
): boolean {
  if (!hasFileUrl) {
    return false
  }
  if (!fileType || fileType === "link" || fileType === "youtube") {
    return false
  }
  if (isMessageImageType(fileType) || isMessageVideoType(fileType)) {
    return false
  }
  return true
}

export function buildChatFileUploadPath(transactionId: string, file: File): string {
  const ext = extensionFromMime(file.type, fileExtension(file.name) || "bin")
  const safeName = sanitizeChatStorageFileName(file.name)
  const base = safeName.replace(/\.[^.]+$/, "") || "file"
  return `${transactionId}/${crypto.randomUUID()}_${base}.${ext}`
}

/** ストレージパス末尾から表示用ファイル名を推定 */
export function displayFileNameFromStoragePath(path: string): string {
  const segment = path.split("/").pop() ?? path
  const underscore = segment.indexOf("_")
  if (underscore >= 0 && underscore < segment.length - 1) {
    const rest = segment.slice(underscore + 1)
    if (rest.includes(".")) {
      return decodeURIComponent(rest.replace(/\+/g, " "))
    }
  }
  return segment
}

export function buildChatFileMessageContent(userText: string, meta: ChatFileMeta): string {
  const payload = JSON.stringify({ name: meta.name, size: meta.size })
  const trimmed = userText.trim()
  if (!trimmed) {
    return `${CHAT_FILE_META_PREFIX}${payload}`
  }
  return `${CHAT_FILE_META_PREFIX}${payload}\n${trimmed}`
}

export function parseChatFileMessageContent(content: string | null | undefined): {
  meta: ChatFileMeta | null
  userText: string
} {
  const raw = content ?? ""
  if (!raw.startsWith(CHAT_FILE_META_PREFIX)) {
    return { meta: null, userText: raw }
  }
  const rest = raw.slice(CHAT_FILE_META_PREFIX.length)
  const newline = rest.indexOf("\n")
  const jsonPart = newline === -1 ? rest : rest.slice(0, newline)
  const userText = newline === -1 ? "" : rest.slice(newline + 1)
  try {
    const parsed = JSON.parse(jsonPart) as { name?: unknown; size?: unknown }
    const name = typeof parsed.name === "string" ? parsed.name : ""
    const size = typeof parsed.size === "number" && Number.isFinite(parsed.size) ? parsed.size : 0
    if (name) {
      return { meta: { name, size }, userText }
    }
  } catch {
    // legacy / corrupt
  }
  return { meta: null, userText: raw }
}

export function messageDisplayText(m: {
  content: string | null
  file_url: string | null
  file_type: string | null
}): string {
  const { meta, userText } = parseChatFileMessageContent(m.content)
  const t = userText.trim()
  if (t) {
    return t
  }
  if (meta) {
    return ""
  }
  const legacy = m.content?.trim() ?? ""
  if (
    m.file_url &&
    (legacy === "[画像]" || legacy === "[動画]" || legacy === "[ファイル]")
  ) {
    return ""
  }
  return legacy
}
