/** 表示名変更の再実行までの待機時間（30日間） */
const DISPLAY_NAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000

export function parseProfileDate(raw: unknown): Date | null {
  if (raw == null) {
    return null
  }
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw
  }
  if (typeof raw === "string") {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** 表示名を新しい値に更新してよいか（前回の更新から30日以上経過している、または未記録） */
export function canChangeDisplayNameAfterCooldown(lastNameChange: Date | null, now: Date = new Date()): boolean {
  if (!lastNameChange) {
    return true
  }
  return now.getTime() - lastNameChange.getTime() >= DISPLAY_NAME_COOLDOWN_MS
}

/** `last_name_change` を起点に、次に表示名変更が可能になる日時 */
export function getNextDisplayNameChangeEligibleAt(lastNameChange: Date | null): Date | null {
  if (!lastNameChange) {
    return null
  }
  return new Date(lastNameChange.getTime() + DISPLAY_NAME_COOLDOWN_MS)
}

export function formatDateYmdSlashes(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}/${m}/${day}`
}
