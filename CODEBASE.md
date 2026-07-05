# MessengerPro Codebase Documentation

## Overview

MessengerPro is an **Electron-based** multi-account desktop wrapper for Facebook Messenger on macOS. It embeds the web Messenger experience (messenger.com / facebook.com) inside a `BrowserView`, layered under a custom sidebar UI that manages accounts, settings, notifications, and premium subscriptions.

## Architecture

The app follows the standard **Electron main/renderer/preload** architecture:

```
src/
├── main/           # Main process (Node.js / Electron APIs)
│   ├── main.ts              # Entry point, window & view management
│   ├── preload.ts           # Context bridge for renderer
│   ├── messengerPreload.ts  # Injected into messenger.com BrowserView
│   ├── accountManager.ts    # Account CRUD & session management
│   ├── authManager.ts       # User authentication (local accounts)
│   ├── appleSignIn.ts       # Sign in with Apple integration
│   ├── cloudSyncManager.ts  # iCloud Key-Value Store sync
│   ├── entitlementManager.ts# Premium entitlement checking
│   ├── store.ts             # Encrypted JSON persistence
│   ├── iapManager.ts        # In-App Purchase handling
│   ├── notificationManager.ts
│   ├── dockManager.ts       # macOS dock badge/bounce
│   └── menuBuilder.ts       # Native macOS menu
├── renderer/       # Renderer process (React + Tailwind)
│   ├── App.tsx              # Main React component
│   ├── main.tsx             # React entry point
│   ├── components/          # React components
│   │   ├── Sidebar/         # Sidebar with workspaces
│   │   ├── Modals/          # Upgrade, Preferences, CreateWorkspace
│   │   ├── WorkspaceView.tsx# Facebook BrowserView area
│   │   └── ICloudLogin.tsx  # Sign in with Apple flow
│   ├── store/               # Zustand state management
│   │   ├── uiStore.ts
│   │   ├── settingsStore.ts
│   │   └── workspaceStore.ts
│   └── lib/utils.ts         # Utility functions
└── shared/         # Shared between main & renderer
    ├── types.ts             # TypeScript interfaces
    └── constants.ts         # App constants
```

---

### Electron ^29.3.0

**Sign in with Apple:**
- Uses ASAuthorizationController for native Apple OAuth
- Stores Apple ID token locally for verification
- Links premium status to Apple ID via StoreKit

### iCloud Key-Value Store

**CloudSyncManager:**
- Uses NSUbiquitousKeyValueStore for cross-device sync
- Syncs: theme, sidebar state, focus mode, workspace metadata
- Does NOT sync: Facebook sessions, API keys, partition data

### Zustand ^5.0.13

State management for React renderer:
- `uiStore.ts` - User session, modals, active workspace
- `settingsStore.ts` - Theme, sidebar, focus mode
- `workspaceStore.ts` - Workspaces and accounts

The entire application is built on **Electron**. It provides:
- `BrowserWindow` — The native macOS window with vibrancy and traffic lights
- `BrowserView` — An embedded web view for loading messenger.com
- `session.fromPartition` — Isolated cookie/storage per account
- `ipcMain` / `ipcRenderer` — Inter-process communication between main and renderer
- `inAppPurchase` — macOS App Store In-App Purchase API
- `app.dock` — macOS dock badge and bounce
- `safeStorage` — OS-level encryption for persisted data
- `Menu` / `MenuItem` — Native macOS menu bar

**Why Electron?** MessengerPro wraps a web application (messenger.com). Electron is the industry standard for embedding web content in a native macOS app with full system integration (dock, notifications, menu bar, StoreKit IAP).

### Vite ^5.2.11 + vite-plugin-electron ^0.28.7

**Vite** is used as the build tool for the renderer process. It provides:
- Sub-second HMR (Hot Module Replacement) during development via the dev server
- Fast production bundling via esbuild/Rollup
- Path aliases (`@shared`, `@renderer`)

The **`vite-plugin-electron`** plugin extends Vite to also build the main and preload scripts (which are normally compiled by `tsc` or webpack in a standard Electron setup). It runs separate Rollup builds for each Electron entry point.

**Why Vite?** Electron apps traditionally require a complex bundler setup (webpack + ts-loader + electron-webpack). Vite with the electron plugin eliminates this complexity while keeping dev feedback loops fast.

### TypeScript ^5.4.5

Strict TypeScript (`strict: true`) is used throughout. Key compiler options:
- `target: ES2022`, `module: ESNext` — Modern JS output
- `moduleResolution: bundler` — Compatible with Vite's import resolution
- `lib: ["ES2022", "DOM", "DOM.Iterable"]` — DOM types for renderer, ES2022 for main

**Why TypeScript?** The app has significant type sharing between main and renderer (via `src/shared/`). TypeScript ensures interfaces like `Account` and `AppSettings` are consistent across process boundaries.

### uuid ^9.0.1

Used in `accountManager.ts` to generate unique IDs for each account:
```ts
const id = uuidv4();
```

**Why uuid?** Accounts need globally unique identifiers for session partitioning, switching, and storage keys. `uuid` v4 produces random UUIDs with negligible collision probability.

### electron-builder ^24.13.3

Builds distributable macOS packages:
- `.dmg` — Direct download installer (for direct distribution)
- `.pkg` / `.mas` — Mac App Store distribution

Configured in `electron-builder.yml` with entitlements, code signing, and notarization support.

**Why electron-builder?** It's the de facto standard for Electron packaging. It handles DMG creation, code signing, and notarization in a declarative config file.

---

## Process Architecture

### Main Process (`main.ts`)

The main process is the **Node.js** heart of the app. It:
1. Enforces single-instance lock (only one app window allowed)
2. Creates the main `BrowserWindow` with macOS vibrancy
3. Creates and positions a `BrowserView` for messenger.com
4. Manages IPC handlers for accounts, settings, and IAP
5. Coordinates all managers (accounts, notifications, dock, IAP)

### Renderer Process (`renderer/main.ts`)

Runs in the main window's webview. It's a **vanilla TypeScript** SPA (no React/Vue) that:
- Renders the sidebar UI (account list, modals)
- Handles user interactions
- Communicates **only** with main via `window.electronAPI` (context bridge)

### Preload Scripts

Electron apps require preload scripts to safely expose Node/Electron APIs to the renderer.

**`preload.ts`** — Exposed to the renderer window via `contextBridge`. Provides the `window.electronAPI` object with:
- `accounts.*` — IPC wrappers for account CRUD
- `settings.*` — IPC wrappers for app settings
- `iap.*` — IPC wrappers for purchases
- Event listeners for unread counts, notifications, menu events

**`messengerPreload.ts`** — Injected into the messenger.com BrowserView. Intercepts:
- `document.title` changes (via MutationObserver + polling) to detect unread count
- `window.Notification` API calls to intercept web notifications and forward them natively

### Context Isolation & Security

```ts
// main.ts — BrowserWindow config
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,    // ✓ Renderer cannot access Node/Electron
  nodeIntegration: false,   // ✓ No Node in renderer
  sandbox: true,            // ✓ OS-level sandboxing
  webSecurity: true,        // ✓ Same-origin policy enforced
},
```

All renderer→main communication goes through:
1. `ipcRenderer.invoke()` (request/response) from renderer
2. `ipcMain.handle()` handlers in main
3. `contextBridge.exposeInMainWorld()` in preload

---

## Core Features & Implementation

### 1. Sign in with Apple

**Authentication Flow:**
1. **Welcome Screen** - User chooses "Sign in with Apple" or "Continue without signing in"
2. **Apple OAuth** - Native dialog for authentication (ASAuthorizationController)
3. **Data Sync** - Fetch iCloud settings/workspaces, check StoreKit subscription
4. **Main App** - Load with Free or Pro tier based on entitlement

**AppleSignIn Manager (`appleSignIn.ts`):**
- Handles OAuth flow via native Apple APIs
- Stores Apple ID, email (if shared), name
- Provides token for verification

**Entitlement Check (`entitlementManager.ts`):**
- On app launch: verify StoreKit for active subscription
- Cache entitlement locally for offline use
- 24-hour grace period after expiry

### 2. Multi-Account Management

**Account Architecture:**
- Each account has its own `session.fromPartition` (isolated cookies/storage)
- Accounts are stored in `Store` with a UUID-based partition key: `persist:account-<uuid>`
- Switching accounts: removes the current `BrowserView`, creates a new one with a fresh session
- Sessions are cleared on account removal

**Subscription Enforcement:**
- Free tier is limited to 1 account (`FREE_TIER_MAX_ACCOUNTS = 1`)
- `AccountManager.listAccounts()` slices accounts to the free limit if not premium
- Attempting to add a 2nd account on free tier opens the upgrade modal
- Premium accounts are kept in storage but hidden when subscription expires (offline fallback)

**Why Session Partitioning?** Messenger.com uses cookies for authentication. By using `session.fromPartition`, each account gets a completely isolated cookie jar — no logins interfere with each other.

### 2. BrowserView & Messenger Integration

**`createMessengerView()` (main.ts:121):**
```ts
messengerView = new BrowserView({
  webPreferences: {
    preload: path.join(__dirname, 'messengerPreload.js'),
    session: acctSession,       // Isolated session per account
    sandbox: false,             // Required for preload IPC
  },
});
mainWindow.addBrowserView(messengerView);
messengerView.webContents.loadURL(MESSENGER_URL); // https://www.facebook.com
```

**Unread Count Detection:**
`messengerPreload.ts` monitors the `<title>` element:
```ts
// title format from Messenger: "(5) John Doe"
// Extracts "5" from the opening parenthesis
function extractUnreadFromTitle(title: string): number {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}
```
Uses both **MutationObserver** (instant) and **polling every 2 seconds** (fallback) to catch title changes. Sends count to main via `ipcRenderer.send('messenger:unread-count', count)`.

**Why not use the Messenger API?** Messenger.com has no official API for external developers. The unread count is encoded in the page `<title>`, which is the most reliable web-scraping approach without API access.

**Web Notification Interception:**
`messengerPreload.ts` replaces `window.Notification` with an `InterceptedNotification` class that:
1. Calls the original `Notification` constructor (Messenger thinks it's working)
2. Forwards the notification to main via IPC
3. Returns a fake `'granted'` for `requestPermission()` (we handle notifications natively)

**Why intercept notifications?** The web notifications would appear in the browser tab. Interception allows the app to display native macOS notifications (with click-to-focus behavior) even when Messenger.com requests a notification.

### 3. Sidebar UI

**Layout:**
- Fixed-position sidebar (72px collapsed / 220px expanded)
- macOS traffic light spacer (52px top)
- Account avatars with initials and unread badges
- Add/Focus/Prefs buttons

**Rendering (`renderer/main.ts:124`):**
- Re-renders on every state change (accounts, settings, unread counts)
- Conditionally shows unread badges on avatars (collapsed) and in the list (expanded)
- Active account highlighted with accent glow

### 4. Settings & Persistence (`store.ts`)

**Custom Store Class:**
- Lightweight JSON store replacing `electron-store`
- Uses `safeStorage` (macOS Keychain) for encryption when available
- Falls back to plain JSON if encryption unavailable
- Stored at `~/Library/Application Support/MessengerPro/app-data.bin`

**Why not electron-store?**
- `electron-store` stores data as plain JSON
- App Store guidelines require secure storage for subscription state
- Custom implementation with `safeStorage` meets the security requirement

**Stored data:**
- `accounts` — Array of account objects
- `settings` — App settings including subscription status

### 5. In-App Purchases (`iapManager.ts`)

Uses Electron's built-in `inAppPurchase` API (macOS StoreKit):

**Products:**
- `com.messengerpro.app.premium_monthly` — $2.99/month
- `com.messengerpro.app.premium_yearly` — $19.99/year

**Purchase Flow:**
1. `iapManager.purchaseProduct()` calls `inAppPurchase.purchaseProduct()`
2. App Store processes payment → triggers `transactions-updated` event
3. `handleTransaction()` receives the transaction
4. `unlockPremium()` stores `{ isPremium: true, premiumExpiresAt: <timestamp> }` in settings
5. Renderer notified via `webContents.send('iap:premium-unlocked', productId)`

**Restore Purchases:**
- `inAppPurchase.restoreCompletedTransactions()` triggers `transactions-updated` for any previously purchased products
- Same `handleTransaction()` path unlocks premium if found

**Subscription Expiry:**
- `isPremium()` checks both `isPremium` flag and `premiumExpiresAt` timestamp
- If expired, returns `false` and `listAccounts()` enforces the free-tier limit

**Dev Mode:**
- On non-macOS or when StoreKit unavailable, purchases are simulated
- Immediately unlocks premium without contacting the App Store

**Why use built-in `inAppPurchase`?**
- No third-party IAP library needed
- Native StoreKit integration via Electron
- Complies with App Store guidelines for subscription management

### 6. Notifications (`notificationManager.ts`)

- Displays native macOS notifications using `new Notification()`
- Supports **Focus Mode** — when enabled, `dispatch()` returns early
- On click: restores/focuses the window and switches to the account that received the notification
- Checks `Notification.isSupported()` before dispatching

**Why native notifications?**
- Better integration with macOS notification center
- User can action directly from the notification center
- Supports click handlers for account-switching behavior

### 7. Dock Manager (`dockManager.ts`)

macOS-specific features:
- **`setUnreadCount()`** — Sets the dock badge (red notification number)
- **`bounce()`** — Makes the dock icon bounce (new message indicator)
- Uses `app.dock` API which only exists on macOS

**Why dock integration?** On macOS, users expect to see unread counts on the dock icon. This is a standard macOS UX pattern that the app honors.

### 8. Native Menu (`menuBuilder.ts`)

Builds the macOS menu bar with:
- **App menu** — About, Preferences, Upgrade, Launch at Login, Quit
- **Accounts menu** — Dynamic list of accounts with unread counts, keyboard shortcuts (Cmd+1-9)
- **View menu** — Toggle Sidebar, Focus Mode, Zoom controls
- **Window menu** — Minimize, Zoom, Bring to Front
- **Help menu** — Support link, Privacy Policy, Disclaimer

Account items are radio buttons (`type: 'radio'`) with `checked` reflecting the active account. Menu is rebuilt on every account/settings change.

### 9. IPC Communication Pattern

All communication follows a request/response pattern via typed IPC:

**Renderer → Main:**
```ts
// Renderer
const accounts = await window.electronAPI.accounts.list();

// Main (main.ts:226)
ipcMain.handle('accounts:list', () => accountManager.listAccounts());
```

**Main → Renderer (events):**
```ts
// Main
mainWindow?.webContents.send('accounts:updated', accounts);

// Renderer
window.electronAPI.accounts.onUpdated((updated) => { ... });
```

**Preload translates:**
```ts
// preload.ts:23
list: (): Promise<Account[]> =>
  ipcRenderer.invoke('accounts:list'),
```

### 10. Build & Distribution

**Build Scripts (`package.json`):**
```json
"dev": "vite"                  // Dev server with HMR
"build": "tsc --noEmit && vite build"  // Type-check + bundling
"build:dmg": "npm run build && electron-builder --mac dmg"   // DMG installer
"build:mas": "npm run build && electron-builder --mac mas"  // App Store build
```

**DMG Configuration (`electron-builder.yml`):**
- App category: `public.app-category.social-networking`
- Hardened Runtime enabled for notarization
- DMG with background image, link to /Applications

---

## File Breakdown

| File | Purpose |
|------|---------|
| `src/main/main.ts` | App entry, window/view creation, IPC setup, lifecycle |
| `src/main/preload.ts` | Context bridge exposing `window.electronAPI` |
| `src/main/messengerPreload.ts` | Injected into messenger.com BrowserView |
| `src/main/authManager.ts` | Local user authentication (signup/login/logout) |
| `src/main/appleSignIn.ts` | Sign in with Apple OAuth handling |
| `src/main/cloudSyncManager.ts` | iCloud Key-Value Store sync for settings/workspaces |
| `src/main/entitlementManager.ts` | Centralized premium entitlement checking |
| `src/main/accountManager.ts` | Account CRUD, session management, free-tier enforcement |
| `src/main/store.ts` | Encrypted JSON persistence with safeStorage |
| `src/main/iapManager.ts` | StoreKit IAP (purchase, restore, expiry check) |
| `src/main/notificationManager.ts` | Native notification dispatch with Focus Mode |
| `src/main/dockManager.ts` | macOS dock badge and bounce |
| `src/main/menuBuilder.ts` | Native macOS menu bar |
| `src/renderer/App.tsx` | Main React component |
| `src/renderer/main.tsx` | React entry point |
| `src/renderer/components/Sidebar/Sidebar.tsx` | Workspace sidebar |
| `src/renderer/components/ICloudLogin.tsx` | Sign in with Apple flow |
| `src/renderer/components/WorkspaceView.tsx` | Facebook BrowserView container |
| `src/renderer/store/uiStore.ts` | User session state |
| `src/renderer/store/settingsStore.ts` | Theme, sidebar, focus mode |
| `src/renderer/store/workspaceStore.ts` | Workspaces and accounts |
| `src/shared/types.ts` | `Account`, `AppSettings`, `PurchaseResult`, `AppleUser` |
| `src/shared/constants.ts` | URLs, product IDs, sidebar widths, avatar colors |

---

## Key Design Decisions

1. **React + Tailwind for renderer** — Modern UI framework with component-based architecture. Uses Zustand for state management. Radix UI for accessible primitives.

2. **Sign in with Apple** — Unified identity across devices. Premium tied to Apple ID via StoreKit. iCloud sync for settings.

3. **BrowserView over webview tag** — `BrowserView` is embedded in the main window without an `<iframe>` or `<webview>` tag. It provides better isolation and memory management than the deprecated `<webview>` element.

4. **Custom Store over electron-store** — Avoids plain-text storage of subscription state. Uses `safeStorage` for encryption when available.

5. **`sandbox: false` for messenger preload** — Required because `messengerPreload.ts` uses `ipcRenderer.send()`. In sandboxed mode, `ipcRenderer` is still available but the session is isolated per BrowserView.

6. **Single-instance lock** — Uses `app.requestSingleInstanceLock()` to prevent multiple app windows. Second instance focuses the existing window instead of opening a new one.

7. **Navigation allowlisting** — `ALLOWED_HOSTS` restricts all `will-navigate` events to prevent navigation away from Messenger.com or Google login. External links open in the system browser via `shell.openExternal()`.

8. **iCloud Key-Value Store** — Lightweight sync for settings and workspace metadata. No CloudKit schema needed. Last-write-wins conflict resolution.

9. **Dev Mode for IAP** — On non-macOS/Linux, purchases are simulated (instant unlock). Allows testing full premium flow without StoreKit.
