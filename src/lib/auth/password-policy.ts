export const AUTH_PASSWORD_MIN_LENGTH = 8

export type PasswordRuleState = {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  isValid: boolean
}

export function getPasswordRuleState(password: string): PasswordRuleState {
  const hasMinLength = password.length >= AUTH_PASSWORD_MIN_LENGTH
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber,
  }
}

export function describeAuthPasswordPolicyError(): string {
  return "パスワードは 8 文字以上で、英大文字・小文字・数字を含めてください。"
}

export function translatePasswordUpdateError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes("same") && lower.includes("password")) {
    return "現在と同じパスワードは使用できません。"
  }
  if (lower.includes("weak") || lower.includes("at least")) {
    return "より強力なパスワードを設定してください。"
  }
  if (lower.includes("invalid login credentials")) {
    return "現在のパスワードが正しくありません。"
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "短時間に変更が多すぎます。少し時間をおいて再度お試しください。"
  }
  if (lower.includes("session") || lower.includes("not authenticated")) {
    return "セッションが切れました。再度ログインしてください。"
  }
  if (
    lower.includes("invalid") &&
    (lower.includes("credential") || lower.includes("login"))
  ) {
    return "現在のパスワードが正しくありません。"
  }
  return "パスワードの変更に失敗しました。時間をおいて再度お試しください。"
}
