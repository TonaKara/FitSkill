type ErrorWithDetails = {
  message?: string
  code?: string
}

export type NoticeVariant = "error" | "success"

export type AppNotice = {
  variant: NoticeVariant
  message: string
}

const DEFAULT_ERROR_MESSAGE = "システムエラーが発生しました。時間を置いてお試しください。"

function resolveFriendlyErrorMessage(rawMessage: string, code?: string) {
  const normalized = rawMessage.toLowerCase()

  if (normalized.includes("invalid login credentials")) {
    return "ログインに失敗しました。メアドかパスワードを確認してください。"
  }

  if (normalized.includes("user already registered")) {
    return "このメールアドレスは既に登録されています。"
  }

  if (code === "23505") {
    return "同じ内容のデータが既に登録されています。"
  }

  return DEFAULT_ERROR_MESSAGE
}

export type ToErrorNoticeOptions = {
  /** 既知パターンに当てはまらないときの一般ユーザー向け文言（省略時は既定の汎用文） */
  unknownErrorMessage?: string
}

export function toErrorNotice(
  error: unknown,
  isAdmin: boolean,
  options?: ToErrorNoticeOptions,
): AppNotice {
  const errorObject = (error ?? {}) as ErrorWithDetails
  const rawMessage = errorObject.message?.trim() ?? ""
  const code = errorObject.code?.trim()

  let userMessage = resolveFriendlyErrorMessage(rawMessage, code)
  if (userMessage === DEFAULT_ERROR_MESSAGE && options?.unknownErrorMessage) {
    userMessage = options.unknownErrorMessage
  }

  if (!isAdmin) {
    return { variant: "error", message: userMessage }
  }

  const detailParts = [code ? `code: ${code}` : "", rawMessage ? `message: ${rawMessage}` : ""].filter(Boolean)

  if (detailParts.length === 0) {
    return { variant: "error", message: userMessage }
  }

  return {
    variant: "error",
    message: `${userMessage}（詳細: ${detailParts.join(" / ")}）`,
  }
}

/** トースト以外（インライン表示など）用。詳細は管理者のみ。 */
export function formatErrorMessageOnly(error: unknown, isAdmin: boolean, options?: ToErrorNoticeOptions): string {
  return toErrorNotice(error, isAdmin, options).message
}

export function toSuccessNotice(message: string): AppNotice {
  return { variant: "success", message }
}
