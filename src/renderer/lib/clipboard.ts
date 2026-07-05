/**
 * safeCopy — reliable clipboard copy for Electron renderer
 *
 * navigator.clipboard.writeText() is async and can silently fail when:
 *   - The document doesn't have focus (BrowserView stole it)
 *   - Permissions API denies clipboard-write
 *   - Secure-context check fails in some Electron builds
 *
 * This utility tries the modern API first, then falls back to the
 * legacy execCommand approach which works regardless of focus/permissions.
 */
export async function safeCopy(text: string): Promise<boolean> {
  // Modern API — works in most cases
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to legacy method
    }
  }

  // Legacy fallback — always works in Electron (no focus/permission requirement)
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
