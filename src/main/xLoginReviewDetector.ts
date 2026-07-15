const X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'])

const AUTH_PATH_PREFIXES = [
  '/i/flow/login',
  '/i/flow/signup',
  '/i/flow/password_reset',
  '/login',
  '/signup',
]

function isXHost(rawUrl: string): boolean {
  try {
    return X_HOSTS.has(new URL(rawUrl).hostname)
  } catch {
    return false
  }
}

export function isXAuthRoute(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return X_HOSTS.has(url.hostname) &&
      AUTH_PATH_PREFIXES.some(p => url.pathname.startsWith(p))
  } catch {
    return false
  }
}

/** Detect one successful interactive login, excluding restored sessions. */
export class XLoginReviewDetector {
  private observedAuthRoute = false
  private emitted = false
  private sessionStateInitialized = false
  private hadSessionCookie = false

  initializeSessionState(hasSessionCookie: boolean): void {
    if (this.sessionStateInitialized) return
    this.hadSessionCookie = hasSessionCookie
    this.sessionStateInitialized = true
  }

  /**
   * A no-cookie → valid-cookie transition is the most reliable login signal
   * and still excludes sessions that were already active when the view loaded.
   */
  observeSessionState(hasSessionCookie: boolean): boolean {
    if (this.emitted) return false
    if (!this.sessionStateInitialized) {
      this.initializeSessionState(hasSessionCookie)
      return false
    }
    const completedLogin = !this.hadSessionCookie && hasSessionCookie
    this.hadSessionCookie = hasSessionCookie
    if (!completedLogin) return false
    this.emitted = true
    return true
  }

  observeNavigation(rawUrl: string, hasSessionCookie: boolean): boolean {
    if (!isXHost(rawUrl) || this.emitted) return false
    if (isXAuthRoute(rawUrl)) {
      this.observedAuthRoute = true
      return false
    }
    if (!this.observedAuthRoute || !hasSessionCookie) return false
    this.emitted = true
    this.hadSessionCookie = true
    return true
  }
}
