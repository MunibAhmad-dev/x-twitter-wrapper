import { ipcRenderer } from 'electron';

/**
 * Preload injected into the tiktok.com BrowserView.
 * Runs in a sandboxed renderer — intercepts title changes and
 * web Notification API calls, forwarding them to main via IPC.
 */

// ── Badge detection via document.title ───────────────────────────────────────
function extractUnreadFromTitle(title: string): number {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

let lastCount = -1;

function checkTitle() {
  const count = extractUnreadFromTitle(document.title);
  if (count !== lastCount) {
    lastCount = count;
    ipcRenderer.send('messenger:unread-count', count);
  }
}

// Poll title every 2 seconds as a fallback
setInterval(checkTitle, 2000);

// Also watch via MutationObserver for instant updates
const titleEl = document.querySelector('title');
if (titleEl) {
  const obs = new MutationObserver(checkTitle);
  obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
}

// Watch for title element to appear if it doesn't exist yet
const headObs = new MutationObserver(() => {
  const t = document.querySelector('title');
  if (t) {
    const obs = new MutationObserver(checkTitle);
    obs.observe(t, { childList: true, characterData: true, subtree: true });
    headObs.disconnect();
  }
});
if (document.head) {
  headObs.observe(document.head, { childList: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.head) headObs.observe(document.head, { childList: true });
  });
}

// ── Native Notification interception ─────────────────────────────────────────
const OriginalNotification = window.Notification;

class InterceptedNotification extends OriginalNotification {
  constructor(title: string, options?: NotificationOptions) {
    super(title, options);
    // Forward to main for native re-dispatch
    ipcRenderer.send('messenger:notification', {
      title,
      body: options?.body ?? '',
      icon: options?.icon ?? '',
    });
  }

  static get permission(): NotificationPermission {
    return OriginalNotification.permission;
  }

  static requestPermission(): Promise<NotificationPermission> {
    // Always grant — we handle notifications natively
    return Promise.resolve('granted' as NotificationPermission);
  }
}

Object.defineProperty(window, 'Notification', {
  value: InterceptedNotification,
  writable: false,
  configurable: false,
});
