import {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  session,
  screen,
  shell,
  nativeTheme,
  Tray,
  Menu,
  nativeImage,
  clipboard,
  globalShortcut,
  net,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Load .env manually — dotenv's cwd detection is unreliable in Electron
;(function loadEnv() {
  const candidates = [
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
    path.join(app.getAppPath(), '.env'),
  ];
  for (const p of candidates) {
    try {
      const content = fs.readFileSync(p, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^\s*([^#=][^=]*?)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      break;
    } catch { /* try next */ }
  }
})()
import { AccountManager } from './accountManager';
import { XLoginReviewDetector, isXAuthRoute } from './xLoginReviewDetector';
import { MenuBuilder } from './menuBuilder';
import { DockManager } from './dockManager';
import { NotificationManager } from './notificationManager';
import { IAPManager } from './iapManager';
import { AuthManager } from './authManager';
import { Store } from './store';
import { Account, Workspace, WorkspaceAccount } from '../shared/types';
import {
  MESSENGER_URL,
  MESSENGER_CHAT_URL,
  LANGUAGE_SETTINGS_URL,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  TOP_BAR_HEIGHT,
  USER_AGENT,
  ALLOWED_HOSTS,
  APP_NAME,
  IAP_PRODUCTS,
  FREE_TIER_MAX_ACCOUNTS,
  OPENAI_MODEL,
  SUPPORTED_LANGUAGES,
} from '../shared/constants';

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// ── Global state ──────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let messengerView: BrowserView | null = null;

let store: Store;
let iapManager: IAPManager;
let accountManager: AccountManager;
let authManager: AuthManager;
let dockManager: DockManager;
let notificationManager: NotificationManager;
let tray: Tray | null = null;

// Active account id tracked separately for quick access
let activeAccountId: string | null = null;
const unreadCounts: Record<string, number> = {};
let isModalOpen = false;
let activeBrowserAccountId: string | null = null;
let browserViewGeneration = 0;
let disposeLoginReviewCookieListener: (() => void) | null = null;

// ── Security: restrict navigation in ALL web contents ─────────────────────────
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    try {
      // Allow local files and local dev server (Vite)
      if (url.startsWith('file://') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
        return;
      }
      const { hostname } = new URL(url);
      const allowed = ALLOWED_HOSTS.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`)
      );
      if (!allowed) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    // OAuth/auth popups (Google, Apple, Twitter callbacks) must stay in-app.
    // Opening them in the system browser breaks the login flow and triggers
    // App Store guideline 4.1 (no redirecting users away for core functionality).
    let isAuthPopup = false;
    try {
      const { hostname, protocol } = new URL(url);
      const AUTH_POPUP_HOSTS = [
        'accounts.google.com',
        'appleid.apple.com',
        'api.twitter.com',
        'twitter.com',
        'www.twitter.com',
        'x.com',
        'www.x.com',
      ];
      isAuthPopup = (protocol === 'https:') &&
        AUTH_POPUP_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
    } catch { /* malformed URL — deny */ }

    if (isAuthPopup) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 640,
          webPreferences: { nodeIntegration: false, contextIsolation: true },
          autoHideMenuBar: true,
          title: 'Sign in',
        },
      };
    }

    // Non-auth external links → system browser
    shell.openExternal(url).catch(() => { });
    return { action: 'deny' };
  });
});

// Resolve assets path: outside asar in packaged builds, relative to __dirname in dev
const assetsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../assets');

// Set dock icon in dev only — in packaged builds the .icns from the app bundle is used.
// Calling setIcon() in production overrides the bundle icon and renders it oversized.
if (!app.isPackaged && process.platform === 'darwin' && app.dock) {
  app.dock.setIcon(path.join(assetsPath, 'icon.png'));
}

// ── Main window creation ──────────────────────────────────────────────────────
function createMainWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(820, height),
    minWidth: 620,
    minHeight: 500,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
    title: APP_NAME,
    icon: path.join(assetsPath, 'icon.png'),
  });

  // Load renderer
  const devUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    initializeAccounts();
  });

  mainWindow.on('resize', repositionMessengerView);
  mainWindow.on('closed', () => {
    mainWindow = null;
    messengerView = null;
  });

  // Build native menu (rebuilt on account changes)
  rebuildMenu();
}

// Show the main window, recreating it if it was previously closed.
// Used by the Window menu so users can always reopen the app window (Apple Guideline 4).
function showOrCreateMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
}

function getInitials(label: string): string {
  return label
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || label[0]?.toUpperCase() || '?';
}

async function refreshXAccountProfile(account: WorkspaceAccount, generation: number): Promise<void> {
  if (!messengerView || !mainWindow) return;
  if (activeBrowserAccountId !== account.id || generation !== browserViewGeneration) return;

  try {
    if (activeBrowserAccountId !== account.id || generation !== browserViewGeneration) return;
    const profile = await messengerView.webContents.executeJavaScript(`
      (() => {
        const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
        const getImageUrl = (root) => {
          if (!root) return '';
          const image = root.matches?.('image[href], image[xlink\\\\:href], img[src]') ? root : root.querySelector('image[href], image[xlink\\\\:href], img[src]');
          return image?.getAttribute('href') || image?.getAttribute('xlink:href') || image?.getAttribute('src') || '';
        };
        const getLabel = (root) => {
          const raw = clean(root?.getAttribute?.('aria-label') || root?.textContent || '');
          return raw
            .replace(/^(your\\s+)?profile\\s*/i, '')
            .replace(/profile$/i, '')
            .replace(/account$/i, '')
            .trim();
        };
        const decodeValue = (value) => {
          if (!value) return '';
          try {
            return JSON.parse('"' + value.replace(/"/g, '\\\\"') + '"');
          } catch {
            return value.replace(/\\\\\\//g, '/').replace(/\\\\u0025/g, '%').trim();
          }
        };
        const isUsableName = (label) => {
          const value = clean(label);
          return value &&
            value.length >= 2 &&
            value.length <= 80 &&
            !/twitter|x\.com|home|menu|explore|notifications|account|profile|search|create|direct|messages/i.test(value);
        };
        const explicitNameRoots = [
          document.querySelector('[aria-label="Your profile"]'),
          document.querySelector('a[href="/me/"]'),
          document.querySelector('a[href*="/me/"]'),
          document.querySelector('a[aria-label][href*="profile.php"]')
        ].filter(Boolean);
        const avatarRoots = [
          ...explicitNameRoots,
          document.querySelector('[aria-label="Account"]'),
          document.querySelector('[aria-label="Your account"]'),
          document.querySelector('[aria-label*="profile" i]'),
          document.querySelector('[data-pagelet*="Profile"]')
        ].filter(Boolean);
        const imageRoots = avatarRoots
          .concat(Array.from(document.querySelectorAll('[aria-label*="profile" i] image, [aria-label*="account" i] image, a[href*="profile"] image, a[href="/me/"] image, svg image, img')).slice(0, 80));
        const avatarUrl = imageRoots
          .map((root) => getImageUrl(root.closest?.('a, div, span') || root))
          .filter(Boolean)
          .find((url) => /pbs\.twimg|twimg|profile/i.test(url) && !/emoji|static/i.test(url)) || '';
        const scriptText = Array.from(document.scripts)
          .map((script) => script.textContent || '')
          .filter((text) => /username|full_name|profile_pic_url|biography|viewer/i.test(text))
          .join('\\n');
        const namePatterns = [
          /"full_name"\\s*:\\s*"([^"]{2,120})"/,
          /"name"\\s*:\\s*"([^"]{2,120})"/,
          /"username"\\s*:\\s*"([^"]{1,60})"/
        ];
        const scriptName = namePatterns
          .map((pattern) => decodeValue(scriptText.match(pattern)?.[1] || ''))
          .find(isUsableName) || '';
        const avatarPatterns = [
          /"profile_pic_url_hd"\\s*:\\s*"([^"]+)"/,
          /"profile_pic_url"\\s*:\\s*"([^"]+)"/,
          /"uri"\\s*:\\s*"(https?:\\\\\\/\\\\\\/[^"]*(?:pbs\\.twimg|twimg)[^"]+)"/
        ];
        const scriptAvatarUrl = avatarPatterns
          .map((pattern) => decodeValue(scriptText.match(pattern)?.[1] || ''))
          .find((url) => /pbs\.twimg|twimg/i.test(url) && !/emoji|static/i.test(url)) || '';
        const domName = explicitNameRoots.map(getLabel).find(isUsableName) || '';
        return { name: scriptName || domName, avatarUrl: scriptAvatarUrl || avatarUrl };
      })();
    `, true) as { name?: string; avatarUrl?: string };

    const updates: Partial<Pick<WorkspaceAccount, 'label' | 'avatarUrl' | 'avatarText'>> = {};
    const avatarUrl = profile?.avatarUrl?.trim();
    const name = profile?.name?.trim();

    if (activeBrowserAccountId !== account.id || generation !== browserViewGeneration) return;

    if (avatarUrl && avatarUrl !== account.avatarUrl) {
      updates.avatarUrl = avatarUrl;
    }

    const shouldReplaceLabel = ['X Account', 'X Profile', 'TikTok Account', 'TikTok Profile', 'Instagram Account', 'Instagram Profile', 'App User', 'Facebook Account'].includes(account.label);
    if (name && (shouldReplaceLabel || account.label !== name)) {
      updates.label = name;
      updates.avatarText = getInitials(name);
    }

    if (Object.keys(updates).length === 0) return;

    const currentAccount = authManager.getWorkspaceAccount(account.id);
    if (!currentAccount || activeBrowserAccountId !== account.id || generation !== browserViewGeneration) return;

    const updated = authManager.updateWorkspaceAccountProfile(account.id, updates);
    if (updated) {
      mainWindow.webContents.send('workspaceAccounts:updated', authManager.listWorkspaceAccounts(updated.workspaceId));
    }
  } catch (err) {
    console.warn('[XProfile] Could not refresh account profile:', err instanceof Error ? err.message : String(err));
  }
}

function scheduleXProfileRefresh(account: WorkspaceAccount, delay = 2500): void {
  const currentUrl = messengerView?.webContents.getURL() ?? '';
  if (currentUrl && !currentUrl.includes('x.com')) return;

  const generation = browserViewGeneration;
  setTimeout(() => refreshXAccountProfile(account, generation), delay);
  setTimeout(() => refreshXAccountProfile(account, generation), delay + 3500);
}

// ── Messenger BrowserView ─────────────────────────────────────────────────────
function createXView(account: WorkspaceAccount | Account): void {
  console.log('[createXView] called', { accountId: account.id, mainWindowExists: !!mainWindow });
  if (!mainWindow) {
    console.log('[createXView] mainWindow is null, returning early');
    return;
  }

  // Tear down previous view
  if (messengerView) {
    browserViewGeneration += 1;
    activeBrowserAccountId = null;
    mainWindow.removeBrowserView(messengerView);
    try { messengerView.webContents.loadURL('about:blank'); } catch { /* ignore */ }
    messengerView = null;
  }

  const acctSession = session.fromPartition(account.partition);
  acctSession.setUserAgent(USER_AGENT);

  // ── X login detection for review trigger ─────────────────────────────────
  if (disposeLoginReviewCookieListener) {
    disposeLoginReviewCookieListener();
    disposeLoginReviewCookieListener = null;
  }
  const loginReviewDetector = new XLoginReviewDetector();
  const xSessionCookieNames = new Set(['auth_token', 'ct0', 'twid']);
  const readHasXSessionCookie = async (): Promise<boolean> => {
    const cookies = await acctSession.cookies.get({ url: 'https://x.com' });
    return cookies.some(c => xSessionCookieNames.has(c.name) && Boolean(c.value));
  };
  const emitXLoginSuccess = (): void => {
    console.log('[review] Confirmed successful interactive X login');
    mainWindow?.webContents.send('review:x-login-success');
  };
  // Capture initial state before user can log in — prevents restored sessions firing the trigger
  readHasXSessionCookie()
    .then(has => loginReviewDetector.initializeSessionState(has))
    .catch(() => {});
  const inspectXSessionTransition = async (): Promise<void> => {
    try {
      const has = await readHasXSessionCookie();
      if (loginReviewDetector.observeSessionState(has)) emitXLoginSuccess();
    } catch {}
  };
  const detectSuccessfulXLogin = async (url: string): Promise<void> => {
    if (isXAuthRoute(url)) { loginReviewDetector.observeNavigation(url, false); return; }
    try {
      const has = await readHasXSessionCookie();
      if (loginReviewDetector.observeNavigation(url, has)) emitXLoginSuccess();
    } catch {}
  };
  const onXCookieChanged = (_e: Electron.Event, cookie: Electron.Cookie): void => {
    if (xSessionCookieNames.has(cookie.name)) void inspectXSessionTransition();
  };
  acctSession.cookies.on('changed', onXCookieChanged);
  disposeLoginReviewCookieListener = () => acctSession.cookies.removeListener('changed', onXCookieChanged);

  // Grant camera + microphone for voice/video demo mode
  acctSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['camera', 'microphone', 'media', 'mediaKeySystem', 'fullscreen', 'notifications'];
    callback(allowed.includes(permission));
  });

  messengerView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'messengerPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      session: acctSession,
      webSecurity: true,
    },
  });

  browserViewGeneration += 1;
  activeBrowserAccountId = account.id;

  // Do NOT unconditionally add to window here.
  // repositionMessengerView() checks isMessagingViewActive and will only
  // attach the view if the renderer is currently showing the messaging view.
  // This prevents the BrowserView from obscuring Dashboard and tool panels
  // while still pre-loading the X session in the background.
  browserViewAttached = false;
  repositionMessengerView();
  console.log('[createXView] BrowserView created, attached:', browserViewAttached);

  messengerView.webContents.loadURL(MESSENGER_URL);
  console.log('[createXView] loadURL called');

  if ('workspaceId' in account) {
    messengerView.webContents.on('did-finish-load', () => {
      sendBrowserState();
      scheduleXProfileRefresh(account, 1800);
      void detectSuccessfulXLogin(messengerView?.webContents.getURL() || '');
    });
    messengerView.webContents.on('did-navigate', (_event, url) => {
      sendBrowserState();
      scheduleXProfileRefresh(account, 1800);
      void detectSuccessfulXLogin(url);
    });
    messengerView.webContents.on('did-navigate-in-page', (_event, url) => {
      sendBrowserState();
      scheduleXProfileRefresh(account, 1800);
      void detectSuccessfulXLogin(url);
    });
  }

  // Forward unread counts
  messengerView.webContents.on('ipc-message', (_e, channel, ...args) => {
    if (channel === 'messenger:unread-count') {
      const count = (args[0] as number) || 0;
      unreadCounts[account.id] = count;
      const total = Object.values(unreadCounts).reduce((s, n) => s + n, 0);
      dockManager.setUnreadCount(total);
      mainWindow?.webContents.send('unread:updated', { ...unreadCounts });
    } else if (channel === 'messenger:notification') {
      const payload = args[0] as { title: string; body: string };
      notificationManager.dispatch(
        { accountId: account.id, ...payload },
        mainWindow
      );
      dockManager.bounce();
    }
  });

  // ── Right-click context menu with AI/Translate shortcuts ─────────────────
  messengerView.webContents.on('context-menu', (_e, params) => {
    const selected = (params.selectionText || '').trim();
    const menuItems: Electron.MenuItemConstructorOptions[] = [];

    // Only show AI/Translate options when text is selected
    if (selected) {
      menuItems.push(
        {
          label: '🤖 Generate AI Reply',
          click: () => mainWindow?.webContents.send('bar:ai-reply', selected),
        },
        {
          label: '🌐 Translate Selected Text',
          click: () => mainWindow?.webContents.send('bar:translate', selected),
        },
        { type: 'separator' }
      );
    }

    // Standard editing actions
    if (selected) menuItems.push({ role: 'copy' });
    if (params.isEditable) {
      if (selected) menuItems.push({ role: 'cut' });
      menuItems.push({ role: 'paste' });
    }
    if (selected || params.isEditable) menuItems.push({ role: 'selectAll' });

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup({ window: mainWindow as import('electron').BrowserWindow });
    }
  });
}

// Legacy function for old Account type
function createMessengerView(account: Account): void {
  createXView(account);
}

let browserViewAttached = false;
let isMessagingViewActive = false;
// Extra pixels reserved for the inline AI/Translate toolbar in the renderer.
// When the toolbar is open the BrowserView shifts down so it is not hidden behind it.
let inlineToolbarHeight = 0;

function repositionMessengerView(): void {
  if (!mainWindow || !messengerView) return;

  const shouldShow = isMessagingViewActive && !isModalOpen;

  if (!shouldShow) {
    if (browserViewAttached) {
      mainWindow.removeBrowserView(messengerView);
      browserViewAttached = false;
      // Return keyboard/clipboard focus to the renderer so the user can
      // Cmd+V into panel textareas immediately after switching away from X.
      mainWindow.webContents.focus();
    }
    return;
  }

  if (!browserViewAttached) {
    mainWindow.addBrowserView(messengerView);
    browserViewAttached = true;
  }

  const settings = accountManager.getSettings();
  const sidebarW = settings.sidebarExpanded
    ? SIDEBAR_WIDTH_EXPANDED
    : SIDEBAR_WIDTH_COLLAPSED;
  const [winW, winH] = mainWindow.getContentSize();
  const topOffset = TOP_BAR_HEIGHT + inlineToolbarHeight;

  messengerView.setBounds({
    x: sidebarW,
    y: topOffset,
    width: winW - sidebarW,
    height: Math.max(0, winH - topOffset),
  });
  messengerView.setAutoResize({ width: true, height: true });
}

function getBrowserState() {
  return {
    canGoBack: messengerView?.webContents.canGoBack() ?? false,
    canGoForward: messengerView?.webContents.canGoForward() ?? false,
    url: messengerView?.webContents.getURL() ?? '',
  };
}

function sendBrowserState(): void {
  mainWindow?.webContents.send('browser:navigation-updated', getBrowserState());
}

// ── Account init ──────────────────────────────────────────────────────────────
function initializeAccounts(): void {
  const accounts = accountManager.listAccounts();
  mainWindow?.webContents.send('accounts:updated', accounts);

  // Auto-detect subscription status on launch & enforce offline fallback
  const allAccounts = store.get<Account[]>('accounts', []);
  if (!iapManager.isPremium() && allAccounts.length > FREE_TIER_MAX_ACCOUNTS) {
    // Wait for renderer to be ready, then trigger the upgrade prompt
    setTimeout(() => {
      mainWindow?.webContents.send('menu:open-upgrade');
    }, 1000);
  }

  const settings = accountManager.getSettings();
  activeAccountId = settings.activeAccountId;

  const active = accounts.find((a) => a.id === activeAccountId) ?? accounts[0];
  if (active) {
    activeAccountId = active.id;

    // We intentionally DO NOT call createMessengerView(active) here.
    // The React frontend handles calling `workspace:loadX` securely.
  }
}

// ── Rebuild native menu after account changes ─────────────────────────────────
function rebuildMenu(): void {
  if (!mainWindow) return;
  const builder = new MenuBuilder(mainWindow, accountManager, showOrCreateMainWindow);
  builder.buildMenu();
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function setupIPC(): void {
  // Browser controls for the top app bar
  ipcMain.handle('browser:goBack', () => {
    if (messengerView?.webContents.canGoBack()) {
      messengerView.webContents.goBack();
    }
    return getBrowserState();
  });

  ipcMain.handle('browser:goForward', () => {
    if (messengerView?.webContents.canGoForward()) {
      messengerView.webContents.goForward();
    }
    return getBrowserState();
  });

  ipcMain.handle('browser:loadX', async () => {
    if (!messengerView) return { success: false, ...getBrowserState() };
    await messengerView.webContents.loadURL(MESSENGER_URL);
    return { success: true, ...getBrowserState() };
  });

  ipcMain.handle('browser:loadMessenger', async () => {
    if (!messengerView) return { success: false, ...getBrowserState() };
    await messengerView.webContents.loadURL(MESSENGER_CHAT_URL);
    return { success: true, ...getBrowserState() };
  });

  ipcMain.handle('browser:loadLanguageSettings', async () => {
    if (!messengerView) return { success: false, ...getBrowserState() };
    await messengerView.webContents.loadURL(LANGUAGE_SETTINGS_URL);
    return { success: true, ...getBrowserState() };
  });

  ipcMain.handle('browser:reload', () => {
    messengerView?.webContents.reload();
    return getBrowserState();
  });

  ipcMain.handle('browser:getState', () => getBrowserState());

  // Grab whatever text the user has currently selected inside the BrowserView.
  // Used by the toolbar "→ AI Reply" / "→ Translate" buttons so the user never
  // has to copy/paste manually (avoids the macOS focus/clipboard issue entirely).
  ipcMain.handle('browser:getSelectedText', async () => {
    if (!messengerView) return { text: '' };
    try {
      const text = await messengerView.webContents.executeJavaScript(
        'window.getSelection()?.toString() ?? ""'
      );
      return { text: typeof text === 'string' ? text.trim() : '' };
    } catch {
      return { text: '' };
    }
  });

  // Accounts
  ipcMain.handle('accounts:list', () => accountManager.listAccounts());

  ipcMain.handle('accounts:add', (_e, label: string, email?: string) => {
    const result = accountManager.addAccount(label, email);
    if ('error' in result) return result;
    mainWindow?.webContents.send('accounts:updated', accountManager.listAccounts());
    rebuildMenu();
    return result;
  });

  ipcMain.handle('accounts:remove', (_e, id: string) => {
    accountManager.removeAccount(id);
    // Clean up session data
    const partition = `persist:account-${id}`;
    session.fromPartition(partition).clearStorageData();
    if (activeAccountId === id) {
      const next = accountManager.listAccounts()[0];
      if (next) {
        activeAccountId = next.id;
        createMessengerView(next);
      } else {
        if (messengerView && mainWindow) {
          mainWindow.removeBrowserView(messengerView);
          messengerView = null;
        }
      }
    }
    mainWindow?.webContents.send('accounts:updated', accountManager.listAccounts());
    rebuildMenu();
  });

  ipcMain.handle('accounts:switch', (_e, id: string) => {
    const account = accountManager.switchAccount(id);
    if (!account) return undefined;
    activeAccountId = id;
    createMessengerView(account);
    mainWindow?.webContents.send('accounts:updated', accountManager.listAccounts());
    rebuildMenu();
    return account;
  });

  // Settings
  ipcMain.handle('settings:get', () => accountManager.getSettings());

  ipcMain.handle('settings:update', (_e, patch: Record<string, unknown>) => {
    const updated = accountManager.updateSettings(patch);
    // Apply focus mode
    if ('focusMode' in patch) {
      notificationManager.setFocusMode(Boolean(patch['focusMode']));
    }
    // Apply auto-launch
    if ('autoLaunch' in patch && process.platform === 'darwin') {
      app.setLoginItemSettings({ openAtLogin: Boolean(patch['autoLaunch']) });
    }
    // Resize messenger view if sidebar toggled
    if ('sidebarExpanded' in patch) {
      repositionMessengerView();
    }
    // Hide BrowserView when any modal is open
    if (isModalOpen) {
      repositionMessengerView();
    }
    mainWindow?.webContents.send('settings:updated', updated);
    rebuildMenu();
    return updated;
  });

  // IAP
  ipcMain.handle('iap:purchase', async (_e, productId: string) => {
    return iapManager.purchaseProduct(productId);
  });

  ipcMain.handle('iap:restore', async () => {
    try {
      await iapManager.restorePurchases();
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[IAP] restorePurchases failed:', msg);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('iap:getProducts', async (_e, productIds: string[]) => {
    return iapManager.getProducts(productIds);
  });

  ipcMain.handle('iap:checkSubscriptionStatus', () => {
    return iapManager.checkSubscriptionStatus();
  });

  ipcMain.handle('iap:resetSubscription', async () => {
    iapManager.resetSubscription();
    // Restart the app immediately to apply
    app.relaunch();
    app.quit();
    return true;
  });

  // ── Inject text into X message input ─────────────────────────────────────
  //
  // WHY execCommand DOESN'T WORK:
  // X uses a rich-text editor which maintains its
  // own internal React state. document.execCommand('insertText') updates the
  // DOM visually but bypasses Lexical's state, so the send button never
  // activates and the text is lost.
  //
  // CORRECT APPROACH:
  // 1. Write text to the OS clipboard via Electron's clipboard module (no
  //    browser permission needed — this runs in the main process).
  // 2. Focus the BrowserView's webContents at the OS level.
  // 3. Use JavaScript to find the message input and click/focus it.
  // 4. Call webContents.paste() — this sends a native OS paste command
  //    (Cmd+V equivalent) which Lexical responds to correctly.
  // ── Inject text into X message input ─────────────────────────────────────
  //
  // Uses webContents.insertText() — Electron's dedicated API for inserting
  // text into the focused element. Unlike execCommand/paste, insertText goes
  // through the browser engine's native InputEvent pipeline which Lexical
  // (X's editor) correctly handles.
  //
  // Flow:
  //   1. Focus the BrowserView at OS level
  //   2. JS finds the chat input and calls .focus() on it
  //   3. Small delay so focus settles
  //   4. webContents.insertText(text) fires natively
  //   5. If insertText unavailable (older Electron), fall back to clipboard paste
  ipcMain.handle('browser:injectText', async (_e, text: string) => {
    if (!messengerView) {
      return { success: false, error: 'no_view', message: 'No messaging view is open.' };
    }

    try {
      // Step 1 — OS-level focus on the BrowserView
      messengerView.webContents.focus();
      await new Promise(r => setTimeout(r, 120));

      // Step 2 — Find and focus the Messenger chat input via JS
      // We look for contenteditable elements in the bottom half of the viewport
      // to avoid accidentally targeting the search bar at the top.
      const found: boolean = await messengerView.webContents.executeJavaScript(`
        (() => {
          const selectors = [
            'div[contenteditable="true"][role="textbox"]',
            'div[data-lexical-editor="true"]',
            'div[contenteditable="true"][spellcheck="true"]',
            'div[contenteditable="true"]',
          ];
          for (const sel of selectors) {
            const all = Array.from(document.querySelectorAll(sel));
            const input = all.filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 80 && r.height > 14 && r.bottom > window.innerHeight * 0.4;
            }).pop() || all.pop();
            if (input) {
              input.click();
              input.focus();
              return true;
            }
          }
          return false;
        })()
      `);

      if (!found) {
        return {
          success: false,
          error: 'no_conversation',
          message: 'No message input found — please open a conversation first.',
        };
      }

      // Step 3 — Wait for focus to settle before inserting
      await new Promise(r => setTimeout(r, 180));

      // Step 4 — Insert using Electron's insertText API (fires native InputEvent)
      // This is the most reliable method: it bypasses clipboard entirely and
      // triggers Lexical's InputEvent handler directly.
      if (typeof messengerView.webContents.insertText === 'function') {
        await messengerView.webContents.insertText(text);
        return { success: true };
      }

      // Step 5 — Fallback: clipboard + paste for older Electron builds
      clipboard.writeText(text);
      await new Promise(r => setTimeout(r, 80));
      messengerView.webContents.paste();
      return { success: true };

    } catch (err) {
      console.error('[injectText] Error:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── AI Reply — runs in main process so net.fetch is not sandbox-blocked ──────
  ipcMain.handle('ai:generateReplies', async (_e, inputText: string, tone: string) => {
    try {
      const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY'] || ''}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: `Generate exactly 3 ${tone} reply suggestions. Return ONLY a JSON array of 3 strings, no markdown, no extra text.` },
            { role: 'user',   content: `Message to reply to: "${inputText}"` },
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });

      const data = await res.json() as any;
      if (data.error) return { success: false, error: data.error.message as string };

      const raw: string = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!raw) return { success: false, error: 'Empty response from AI' };

      // Strip markdown code fences that GPT sometimes adds
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

      // Try direct JSON parse
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, replies: parsed.map(String).slice(0, 3) };
        }
      } catch { /* try fallbacks */ }

      // Try extracting the array portion from surrounding text
      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { success: true, replies: parsed.map(String).slice(0, 3) };
          }
        } catch { /* try next fallback */ }
      }

      // Treat numbered/bulleted lines as individual replies
      const lines = cleaned
        .split('\n')
        .map((l: string) => l.replace(/^[\d.\-\*"'\s]+/, '').replace(/["']$/, '').trim())
        .filter((l: string) => l.length > 8)
        .slice(0, 3);
      if (lines.length > 0) return { success: true, replies: lines };

      return { success: false, error: 'Could not parse AI response' };
    } catch (err) {
      console.error('[AI:generateReplies] Error:', err);
      return { success: false, error: `Network error: ${String(err)}` };
    }
  });

  // ── AI Translation — also runs in main process ────────────────────────────
  ipcMain.handle('ai:translate', async (_e, text: string, targetLangCode: string) => {
    const langName = (SUPPORTED_LANGUAGES as readonly { code: string; name: string }[])
      .find(l => l.code === targetLangCode)?.name || targetLangCode;
    try {
      const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY'] || ''}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: `You are a professional translator. Translate the following text to ${langName}. Return ONLY the translated text — no explanations, no labels.` },
            { role: 'user',   content: text },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      const data = await res.json() as any;
      if (data.error) return { success: false, error: data.error.message as string };

      const translated: string = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!translated) return { success: false, error: 'Empty translation response' };

      return { success: true, text: translated };
    } catch (err) {
      console.error('[AI:translate] Error:', err);
      return { success: false, error: `Network error: ${String(err)}` };
    }
  });

  // ── AI Post Studio — generate X tweets & hashtags (main process) ──────
  // kind: 'caption' → returns { text } (a catchy tweet/thread opener)
  //       'hashtags' → returns { hashtags: string[] } (relevant X hashtags)
  ipcMain.handle('ai:generatePostContent', async (_e, topic: string, kind: 'caption' | 'hashtags', tone = 'friendly') => {
    const cleanTopic = (topic || '').trim();
    if (!cleanTopic) return { success: false, error: 'Describe your post first' };

    const system = kind === 'hashtags'
      ? `You are an X (Twitter) growth strategist. Generate 12 to 15 highly relevant, trending hashtags for the given post topic. Mix broad and niche tags. Return ONLY a JSON array of strings, each starting with "#", no markdown, no extra text.`
      : `You are an X (Twitter) content strategist. Write one engaging tweet for the given topic in a ${tone} tone: a scroll-stopping hook line followed by a short description. Keep it under 280 characters, add 1-2 fitting emojis. Return ONLY the tweet text — no quotes, no labels, no hashtags.`;

    try {
      const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY'] || ''}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user',   content: `Post topic: "${cleanTopic}"` },
          ],
          max_tokens: 400,
          temperature: kind === 'hashtags' ? 0.6 : 0.8,
        }),
      });

      const data = await res.json() as any;
      if (data.error) return { success: false, error: data.error.message as string };

      const raw: string = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!raw) return { success: false, error: 'Empty response from AI' };

      if (kind === 'caption') {
        const text = raw.replace(/^["']|["']$/g, '').trim();
        return { success: true, text };
      }

      // hashtags — parse a JSON array, with fallbacks for non-JSON responses
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const normalize = (tags: string[]) =>
        tags
          .map((t) => String(t).trim().replace(/^#*/, '#').replace(/\s+/g, ''))
          .filter((t) => t.length > 1)
          .slice(0, 15);

      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { success: true, hashtags: normalize(parsed) };
        }
      } catch { /* try fallbacks */ }

      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return { success: true, hashtags: normalize(parsed) };
          }
        } catch { /* try next fallback */ }
      }

      // Last resort: pull #tokens or split on whitespace/commas
      const fromHashes = cleaned.match(/#[\p{L}\p{N}_]+/gu);
      const tags = fromHashes && fromHashes.length > 0
        ? fromHashes
        : cleaned.split(/[\s,]+/);
      const normalized = normalize(tags);
      if (normalized.length > 0) return { success: true, hashtags: normalized };

      return { success: false, error: 'Could not parse hashtags' };
    } catch (err) {
      console.error('[AI:generatePostContent] Error:', err);
      return { success: false, error: `Network error: ${String(err)}` };
    }
  });

  // ── AI Thread Generator ───────────────────────────────────────────────────
  ipcMain.handle('ai:generateThread', async (_e, topic: string, tweetCount: number, tone: string) => {
    const cleanTopic = (topic || '').trim();
    if (!cleanTopic) return { success: false, error: 'Describe your topic first' };
    const count = Math.max(3, Math.min(20, tweetCount || 7));
    try {
      const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY'] || ''}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an expert Twitter/X content creator. Create a viral ${tone} Twitter thread of exactly ${count} tweets about the given topic.
Rules:
- Tweet 1 must be a hook that grabs attention and makes people want to read more
- Each tweet must be under 280 characters
- Number each tweet like "1/" "2/" etc.
- Make each tweet valuable and standalone
- Last tweet should be a strong call-to-action or summary
- Return ONLY a JSON array of ${count} strings (the tweets), no markdown, no extra text`,
            },
            { role: 'user', content: `Thread topic: "${cleanTopic}"` },
          ],
          max_tokens: 1200,
          temperature: 0.8,
        }),
      });
      const data = await res.json() as any;
      if (data.error) return { success: false, error: data.error.message as string };
      const raw: string = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!raw) return { success: false, error: 'Empty response from AI' };
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) return { success: true, tweets: parsed.map(String) };
      } catch { /* fall through */ }
      const arrayMatch = cleaned.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) return { success: true, tweets: parsed.map(String) };
        } catch { /* fall through */ }
      }
      // Numbered lines fallback
      const lines = cleaned
        .split('\n')
        .map((l: string) => l.replace(/^["'\s]+|["'\s]+$/g, '').trim())
        .filter((l: string) => l.length > 5);
      if (lines.length > 0) return { success: true, tweets: lines };
      return { success: false, error: 'Could not parse AI response' };
    } catch (err) {
      console.error('[AI:generateThread] Error:', err);
      return { success: false, error: `Network error: ${String(err)}` };
    }
  });

  // ── AI Tweet Optimizer ────────────────────────────────────────────────────
  ipcMain.handle('ai:optimizeTweet', async (_e, tweet: string) => {
    const cleanTweet = (tweet || '').trim();
    if (!cleanTweet) return { success: false, error: 'Paste a tweet first' };
    try {
      const res = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY'] || ''}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an expert Twitter/X copywriter. Optimize the given tweet to maximize engagement.
Goals:
- Make it more engaging and compelling
- Ensure it's under 280 characters
- Improve clarity and reach
- Keep the original meaning and voice
- Add emojis only if they improve the tweet
- Return ONLY a JSON object with two keys:
  "optimized": the improved tweet text (string, under 280 chars)
  "explanation": one short sentence explaining the key change made (string)
No markdown, no extra text.`,
            },
            { role: 'user', content: `Original tweet: "${cleanTweet}"` },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      const data = await res.json() as any;
      if (data.error) return { success: false, error: data.error.message as string };
      const raw: string = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!raw) return { success: false, error: 'Empty response from AI' };
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.optimized) return { success: true, optimized: String(parsed.optimized), explanation: String(parsed.explanation || '') };
      } catch { /* fall through */ }
      // If not JSON, treat the whole response as the optimized tweet
      return { success: true, optimized: cleaned.replace(/^["']|["']$/g, '').trim(), explanation: '' };
    } catch (err) {
      console.error('[AI:optimizeTweet] Error:', err);
      return { success: false, error: `Network error: ${String(err)}` };
    }
  });

  // Dock badge control
  // Window controls — locked during onboarding until user subscribes
  ipcMain.on('window:setClosable', (_e, enabled: boolean) => {
    mainWindow?.setClosable(enabled);
  });
  ipcMain.on('window:setMinimizable', (_e, enabled: boolean) => {
    mainWindow?.setMinimizable(enabled);
  });

  ipcMain.on('dock:setBadgeEnabled', (_e, enabled: boolean) => {
    dockManager.setBadgeEnabled(enabled);
  });

  ipcMain.handle('dock:getCount', () => dockManager.getCount());

  // External links (blocked by window open handler, use shell instead)
  ipcMain.on('shell:openExternal', (_e, url: string) => {
    // Allow http/https URLs and mailto: links (support email).
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('[shell:openExternal] failed to open:', url, err);
      });
    } else {
      console.warn('[shell:openExternal] blocked non-http URL:', url);
    }
  });

  // Modals state
  ipcMain.on('modals:state', (_e, isOpen: boolean) => {
    console.log('[modals:state] received', { isOpen });
    isModalOpen = isOpen;
    repositionMessengerView();
  });

  // Renderer tells us which view is active.
  ipcMain.on('browser:setMessagingActive', (_e, active: boolean) => {
    isMessagingViewActive = active;
    repositionMessengerView();
  });

  // Inline AI/Translate toolbar height — BrowserView shifts down so it isn't
  // hidden behind the React toolbar panel.
  ipcMain.on('browser:setToolbarHeight', (_e, height: number) => {
    inlineToolbarHeight = Math.max(0, height);
    repositionMessengerView();
  });

  // Menu relay → renderer
  ipcMain.on('menu:switch-account', (_e, id: string) => {
    ipcMain.emit('accounts:switch', null, id);
  });

  // Auth
  ipcMain.handle('auth:signup', (_e, username: string, password: string) => {
    return authManager.signup(username, password);
  });

  ipcMain.handle('auth:login', (_e, username: string, password: string) => {
    return authManager.login(username, password);
  });

  ipcMain.handle('auth:logout', () => {
    authManager.logout();
    return { success: true };
  });

  ipcMain.handle('auth:currentUser', () => {
    console.log('[IPC] auth:currentUser called, user:', authManager.getCurrentUser());
    return authManager.getCurrentUser();
  });

  ipcMain.handle('auth:isLoggedIn', () => {
    return authManager.isLoggedIn();
  });

  ipcMain.handle('auth:autoLogin', () => {
    return authManager.ensureAutoLogin();
  });

  // IAP Dev Mode Toggle
  ipcMain.handle('iap:setDevMode', (_e, enabled: boolean) => {
    iapManager.setDevMode(enabled);
    return { success: true };
  });

  ipcMain.handle('iap:isDevMode', () => {
    return iapManager.isDevMode();
  });

  // Workspaces
  ipcMain.handle('workspace:create', (_e, name: string, icon?: string, color?: string) => {
    console.log('[IPC] workspace:create called', { name, icon, color });
    authManager.refreshCurrentUserId();
    const result = authManager.createWorkspace(name, icon, color);
    console.log('[IPC] workspace:create result:', result);
    return result;
  });

  ipcMain.handle('workspace:list', () => {
    console.log('[IPC] workspace:list called');
    return authManager.listWorkspaces();
  });

  ipcMain.handle('workspace:get', (_e, id: string) => {
    return authManager.getWorkspace(id);
  });

  ipcMain.handle('workspace:update', (_e, id: string, updates: Partial<Workspace>) => {
    return authManager.updateWorkspace(id, updates);
  });

  ipcMain.handle('workspace:delete', (_e, id: string) => {
    return authManager.deleteWorkspace(id);
  });

  // Workspace Accounts
  ipcMain.handle('workspaceAccount:add', (_e, workspaceId: string, label: string, email?: string) => {
    return authManager.addWorkspaceAccount(workspaceId, label, email);
  });

  ipcMain.handle('workspaceAccount:list', (_e, workspaceId: string) => {
    console.log('[IPC] workspaceAccount:list called for workspace:', workspaceId);
    return authManager.listWorkspaceAccounts(workspaceId);
  });

  ipcMain.handle('workspaceAccount:get', (_e, id: string) => {
    return authManager.getWorkspaceAccount(id);
  });

  ipcMain.handle('workspaceAccount:remove', (_e, id: string) => {
    if (activeBrowserAccountId === id && messengerView && mainWindow) {
      browserViewGeneration += 1;
      activeBrowserAccountId = null;
      mainWindow.removeBrowserView(messengerView);
      try { messengerView.webContents.loadURL('about:blank'); } catch { /* ignore */ }
      messengerView = null;
      browserViewAttached = false;
    }
    return authManager.removeWorkspaceAccount(id);
  });

  ipcMain.handle('workspace:setPremium', (_e, workspaceId: string, isPremium: boolean) => {
    return authManager.setWorkspacePremium(workspaceId, isPremium);
  });

  // Workspace X - Load X in BrowserView
  ipcMain.handle('workspace:loadX', (_e, workspaceId: string, accountId?: string) => {
    console.log('[IPC] workspace:loadX START', { workspaceId, accountId, mainWindow: !!mainWindow });
    try {
      console.log('[IPC] inside try, mainWindow:', !!mainWindow);
      // Get the account to use
      let account = authManager.getWorkspaceAccount(accountId || '');

      if (!account && workspaceId) {
        // If no accountId provided, get first account for workspace
        const accounts = authManager.listWorkspaceAccounts(workspaceId);
        account = accounts[0];
      }

      if (!account) {
        // No account yet - create one with fresh partition
        const newAccount = authManager.addWorkspaceAccount(workspaceId, 'X Account');
        if ('error' in newAccount) {
          return { success: false, error: newAccount.error };
        }
        account = newAccount;
      }

      // Create BrowserView with this account's partition
      createXView(account);
      return { success: true, accountId: account.id };
    } catch (err) {
      console.error('Failed to load X:', err);
      return { success: false, error: 'Failed to load X' };
    }
  });

  ipcMain.handle('review:requestNative', () => {
    if (process.platform !== 'darwin') return false;
    try {
      const storeReview = require('store-review');
      const invoked = storeReview.requestReview() === true;
      console.log(`[review] SKStoreReviewController invoked=${invoked}`);
      return invoked;
    } catch (err) {
      console.warn('[review] store-review addon unavailable:', err);
      return false;
    }
  });

  ipcMain.handle('workspace:hideX', () => {
    console.log('[IPC] workspace:hideX called');
    if (messengerView && mainWindow) {
      browserViewGeneration += 1;
      activeBrowserAccountId = null;
      mainWindow.removeBrowserView(messengerView);
      try { messengerView.webContents.loadURL('about:blank'); } catch { /* ignore */ }
      messengerView = null;
      browserViewAttached = false;
      console.log('[IPC] workspace:hideX: BrowserView destroyed');
    }
    return true;
  });
}

// ── Menu bar Tray ─────────────────────────────────────────────────────────────
function setupTray(): void {
  if (!process.platform === undefined) return; // guard

  // Build a simple 16x16 template PNG from base64 (a message bubble icon)
  // Replace with a real `assets/tray-icon@2x.png` for production polish.
  const iconDataURL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH5gYSECkZxBOWiAAAAJdJREFUOMtjYBgF+IH///8z4pJkYGBg+M/AwMBAjGYGBgYGRmI0MzAwMDDiowEAAAD//wMABQ4CBHnBMb0AAAAASUVORK5CYII=';

  let trayIcon = nativeImage.createFromDataURL(iconDataURL);
  // On macOS set as template for proper dark/light mode support
  if (process.platform === 'darwin') trayIcon = trayIcon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Messaging Workspace');

  const buildTrayMenu = () => Menu.buildFromTemplate([
    { label: 'Show App', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => { mainWindow?.show(); mainWindow?.webContents.send('menu:navigate', 'dashboard'); },
    },
    {
      label: 'Open Messaging',
      click: () => { mainWindow?.show(); mainWindow?.webContents.send('menu:navigate', 'messaging'); },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(buildTrayMenu());

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) { mainWindow.focus(); }
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  store = new Store('app-data');
  iapManager = new IAPManager(store);
  accountManager = new AccountManager(store, iapManager);
  authManager = new AuthManager(store);
  dockManager = new DockManager();
  notificationManager = new NotificationManager();

  iapManager.initialize();
  setupIPC();
  createMainWindow();
  setupTray();

  // ── Global keyboard shortcuts ─────────────────────────────────────────
  // Cmd+Shift+M → show/hide app
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Cmd+1–5 → navigate to views (registered in renderer via onMenuEvent)
  const viewShortcuts: Array<[string, string]> = [
    ['CommandOrControl+1', 'dashboard'],
    ['CommandOrControl+2', 'messaging'],
    ['CommandOrControl+3', 'ai-reply'],
    ['CommandOrControl+4', 'translate'],
    ['CommandOrControl+5', 'analytics'],
  ];
  for (const [accel, view] of viewShortcuts) {
    globalShortcut.register(accel, () => {
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send('menu:navigate', view);
    });
  }

  // Restore login item setting on launch
  if (process.platform === 'darwin') {
    const settings = accountManager.getSettings();
    if (settings.autoLaunch !== undefined) {
      app.setLoginItemSettings({ openAtLogin: settings.autoLaunch });
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Quit the app when the last window closes on all platforms.
app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

