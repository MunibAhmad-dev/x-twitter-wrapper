import { Notification, BrowserWindow } from 'electron';
import { NotificationPayload } from '../shared/types';
import { APP_NAME } from '../shared/constants';

export class NotificationManager {
  private focusMode = false;

  setFocusMode(enabled: boolean): void {
    this.focusMode = enabled;
  }

  dispatch(payload: NotificationPayload, mainWin: BrowserWindow | null): void {
    if (this.focusMode) return;
    if (!Notification.isSupported()) return;

    const notif = new Notification({
      title: payload.title || APP_NAME,
      body: payload.body || '',
      silent: false,
    });

    notif.on('click', () => {
      if (mainWin) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.focus();
        // Tell renderer to switch to the account that received the notification
        mainWin.webContents.send('notification:clicked', payload.accountId);
      }
    });

    notif.show();

    // ── Also log this notification to the renderer's Notification History panel ──
    // This is separate from the macOS native notification above.
    // The renderer listens for 'notification:logged' (registered in App.tsx).
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('notification:logged', {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        accountId: payload.accountId || '',
        title: payload.title || APP_NAME,
        body: payload.body || '',
        receivedAt: Date.now(),
      });
    }
  }
}
