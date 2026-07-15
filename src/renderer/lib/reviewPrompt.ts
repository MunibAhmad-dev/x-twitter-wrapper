import { APP_STORE_REVIEW_URL } from '../../shared/constants'

export const REVIEW_LEFT_KEY = 'review_left'
export const REVIEW_DISMISS_KEY = 'review_dismissed_at'
export const REVIEW_VERSION_KEY = 'review_last_version'
export const REVIEW_LAUNCH_KEY = 'review_launch_count'
export const REVIEW_SESSION_KEY = 'review_session_start'
export const REVIEW_STATE_VERSION_KEY = 'review_state_version'

const REVIEW_STATE_VERSION = 'direct-review-v1'
export const REVIEW_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000

export function migrateReviewPromptState(): void {
  if (localStorage.getItem(REVIEW_STATE_VERSION_KEY) === REVIEW_STATE_VERSION) return
  localStorage.removeItem(REVIEW_LEFT_KEY)
  localStorage.removeItem(REVIEW_DISMISS_KEY)
  localStorage.removeItem(REVIEW_VERSION_KEY)
  localStorage.setItem(REVIEW_STATE_VERSION_KEY, REVIEW_STATE_VERSION)
}

export function shouldShowReview(currentVersion: string): boolean {
  if (localStorage.getItem(REVIEW_LEFT_KEY)) return false
  const lastVersion = localStorage.getItem(REVIEW_VERSION_KEY)
  const dismissedAt = Number(localStorage.getItem(REVIEW_DISMISS_KEY) || '0')
  const isNewVersion = lastVersion !== currentVersion
  return isNewVersion || !dismissedAt || Date.now() - dismissedAt >= REVIEW_SNOOZE_MS
}

export function recordReviewLaunch(): number {
  const count = Number(localStorage.getItem(REVIEW_LAUNCH_KEY) || '0') + 1
  localStorage.setItem(REVIEW_LAUNCH_KEY, String(count))
  return count
}

export function isThirdReviewLaunch(count: number): boolean {
  return count === 3
}

export function dismissReview(currentVersion: string, now = Date.now()): void {
  localStorage.setItem(REVIEW_VERSION_KEY, currentVersion)
  localStorage.setItem(REVIEW_DISMISS_KEY, String(now))
}

export function resetReviewPrompt(): void {
  localStorage.removeItem(REVIEW_LEFT_KEY)
  localStorage.removeItem(REVIEW_DISMISS_KEY)
  localStorage.removeItem(REVIEW_LAUNCH_KEY)
  localStorage.removeItem(REVIEW_VERSION_KEY)
  localStorage.removeItem(REVIEW_STATE_VERSION_KEY)
}

export async function requestNativeReview(currentVersion: string): Promise<void> {
  dismissReview(currentVersion)
  try {
    const invoked = await (window.electronAPI as any)?.requestNativeReview?.()
    if (!invoked) window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
  } catch {
    window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
  }
}
