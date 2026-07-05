import { app } from 'electron';

const isMac = process.platform === 'darwin';

export class DockManager {
  private currentCount = 0;
  private badgeEnabled = true;

  /** Enable or disable the dock badge entirely (user preference). */
  setBadgeEnabled(enabled: boolean): void {
    this.badgeEnabled = enabled;
    if (!enabled) {
      this.clearBadge();
    } else {
      // Re-apply current count if re-enabled
      this.setUnreadCount(this.currentCount);
    }
  }

  setUnreadCount(count: number): void {
    if (!isMac || !app.dock) return;
    this.currentCount = count;
    if (!this.badgeEnabled) return;
    if (count > 0) {
      app.dock.setBadge(count > 99 ? '99+' : String(count));
    } else {
      app.dock.setBadge('');
    }
  }

  bounce(type: 'critical' | 'informational' = 'informational'): void {
    if (!isMac || !app.dock) return;
    // Only bounce if badge is enabled (respect DND preference)
    if (!this.badgeEnabled) return;
    app.dock.bounce(type);
  }

  clearBadge(): void {
    if (!isMac || !app.dock) return;
    app.dock.setBadge('');
    this.currentCount = 0;
  }

  getCount(): number {
    return this.currentCount;
  }
}
