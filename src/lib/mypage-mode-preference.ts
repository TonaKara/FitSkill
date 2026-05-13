/** MypageClient / スマホヘッダーメニュー / BottomNav で共有 */
export const MYPAGE_MODE_STORAGE_KEY = "mypage_mode_preference"

/** 旧ヘッダーメニュー専用キー（読み取り時に {@link MYPAGE_MODE_STORAGE_KEY} へ移行） */
const LEGACY_MOBILE_MYPAGE_MODE_KEY = "mobile_mypage_mode_preference"

export type MypageModePreference = "student" | "instructor"

export const MYPAGE_MODE_PREFERENCE_CHANGE_EVENT = "gritvib:mypage-mode-preference-changed"

export function parseStoredMypageModePreference(): MypageModePreference | null {
  if (typeof window === "undefined") {
    return null
  }
  const raw = window.localStorage.getItem(MYPAGE_MODE_STORAGE_KEY)
  if (raw === "student" || raw === "instructor") {
    return raw
  }
  const legacy = window.localStorage.getItem(LEGACY_MOBILE_MYPAGE_MODE_KEY)
  if (legacy === "student" || legacy === "instructor") {
    window.localStorage.setItem(MYPAGE_MODE_STORAGE_KEY, legacy)
    return legacy
  }
  return null
}

export function readMypageModePreference(fallback: MypageModePreference = "student"): MypageModePreference {
  return parseStoredMypageModePreference() ?? fallback
}

/** localStorage 更新＋同一タブ向け CustomEvent（BottomNav 等が即時反映する） */
export function writeMypageModePreference(mode: MypageModePreference) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(MYPAGE_MODE_STORAGE_KEY, mode)
  window.dispatchEvent(new CustomEvent(MYPAGE_MODE_PREFERENCE_CHANGE_EVENT, { detail: mode }))
}
