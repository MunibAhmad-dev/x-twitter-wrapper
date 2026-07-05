# Cross-Device Sync Design: MessengerPro

## 1. Overview

This design enables users to:
- **Sync workspaces (account metadata)** across Macs via iCloud
- **Use their subscription on multiple devices** via Apple Restore
- **Access settings** anywhere without manual reconfiguration

### Key Principles
- **MAS-compliant**: No external auth, no session transfer
- **Apple-native subscription**: Restore purchases works natively
- **Device-local sessions**: Facebook login is per-device (by design)
- **Graceful degradation**: App works fully offline, sync is optional enhancement

---

## 2. Data Architecture

### 2.1 Data Categories

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Categories                          │
├──────────────────┬──────────────────┬───────────────────────┤
│     Setting      │   Account        │   Subscription       │
│                  │   Metadata        │                       │
├──────────────────┼──────────────────┼───────────────────────┤
│ - theme          │ - label          │ - isPremium           │
│ - sidebarExpanded│ - email          │ - premiumExpiresAt    │
│ - focusMode      │ - avatarColor    │ - productId           │
│ - notifications  │ - createdAt      │ - source (apple)      │
│ - autoLaunch     │ - lastUsed       │                       │
├──────────────────┼──────────────────┼───────────────────────┤
│ iCloud Synced ✓  │ iCloud Synced ✓  │ StoreKit (native) ✓   │
│                  │                  │                       │
│ Device Local:    │ Device Local:    │ Device Local:         │
│ (none)           │ - partition      │ (entitlement snapshot) │
│                  │ - unreadCount    │                       │
└──────────────────┴──────────────────┴───────────────────────┘
```

### 2.2 Why partition/unreadCount stay device-local

- **partition**: Contains Facebook cookies/SessionStorage. Meta's auth is device-bound. Cannot sync without explicit user action.
- **unreadCount**: Changes every second. Syncing would cause race conditions. Each device computes it locally.

---

## 3. iCloud Sync Architecture

### 3.1 Technology Choice: NSUbiquitousKeyValueStore (iCloud KVS)

**Why iCloud KVS over CloudKit:**
- Simpler to implement (key-value, no schema)
- Automatic conflict resolution (last-write-wins)
- Apple handles all network/auth
- Perfect for <1MB of settings/metadata
- No separate CloudKit container needed

**Limits:**
- 1MB total, 1024 keys max
- Keys: 64 chars, Values: 1MB each
- Our usage: ~5-10KB (far under limit)

### 3.2 Sync Schema

```
iCloud KVS Keys:
├── "mp_settings"        → JSON(AppSettingsSync)  # settings only, no secrets
├── "mp_accounts"        → JSON(AccountSync[])     # account metadata
└── "mp_last_sync"       → number (timestamp)
```

```typescript
// Shared types for iCloud sync
interface AppSettingsSync {
  focusMode: boolean;
  autoLaunch: boolean;
  showNotifications: boolean;
  sidebarExpanded: boolean;
  theme: "light" | "dark";
}

interface AccountSync {
  id: string;          // stable across devices
  label: string;
  email?: string;
  avatarColor: string;
  createdAt: number;
}
```

### 3.3 Sync Flow

```
Device A changes setting
    │
    ▼
Store.updateSettings(patch)
    │
    ▼
iCloudSyncManager.push("mp_settings", newSettings)
    │
    ▼
NSUbiquitousKeyValueStore.synchronize()
    │
    ▼ (via iCloud, not instant)
    ▼
Device B receives notification
    │
    ▼
iCloudSyncManager.onExternalChange()
    │
    ▼
Merge & persist to local Store
    │
    ▼
Notify renderer: settings:updated
```

### 3.4 Conflict Resolution

iCloud KVS uses **last-write-wins** for conflicts (simplest, good enough for settings).

For accounts, we add a layer:
- Use `createdAt` timestamp as tiebreaker
- If same `id` exists, keep the one with newer `lastUsed`
- No destructive merge (accounts are additive)

---

## 4. Subscription Across Devices

### 4.1 How MAS Subscriptions Work

```
┌─────────────────────────────────────────────────────────────┐
│              Apple Subscription Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Purchase (Device A)          Restore (Device B)           │
│         │                            │                      │
│         ▼                            ▼                      │
│   StoreKit.purchaseProduct()    StoreKit.                   │
│         │                     restoreCompletedTransactions() │
│         ▼                            │                      │
│   transaction-updated             ▼                         │
│   (validate & store              transaction-updated        │
│    entitlement locally)          (same validation,          │
│         │                     store locally)                 │
│         ▼                            │                      │
│   isPremium = true                isPremium = true          │
│                                                             │
│   Both devices: Same Apple ID → Same subscription status    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Subscription Verification on Launch

Every app launch, we must verify entitlement:

```typescript
async function verifyEntitlement() {
  // Step 1: Check local cache
  const settings = store.get('settings', {});
  if (settings.isPremium && isCacheValid(settings.premiumExpiresAt)) {
    return; // Use cached entitlement
  }

  // Step 2: Refresh from StoreKit
  await iapManager.refreshEntitlements();

  // Step 3: If still not premium, check if we should show upsell
  if (!iapManager.isPremium()) {
    // Grace period: allow 24h offline use after expiry
    if (settings.premiumExpiresAt &&
        Date.now() - settings.premiumExpiresAt < GRACE_PERIOD) {
      return; // Still treat as premium during grace
    }
  }
}
```

### 4.3 Restore Purchases Implementation

```typescript
// In iapManager.ts
async restore(): Promise<void> {
  return new Promise((resolve, reject) => {
    inAppPurchase.restoreCompletedTransactions();

    // Listen for transaction updates
    const handler = (transactions) => {
      for (const tx of transactions) {
        this.handleTransaction(tx);
      }
      // After restore completes, verify all entitlements
      this.verifyAllEntitlements();
      resolve();
    };

    inAppPurchase.on('transactions-updated', handler);
  });
}
```

### 4.4 Subscription Entitlements on Multiple Devices

| Device | State | Behavior |
|--------|-------|----------|
| Device A (original purchase) | Premium | Full access |
| Device B (same Apple ID) | Premium | Restore purchases → Full access |
| Device C (different Apple ID) | Not Premium | Must purchase separately |

**Important:** Apple manages multi-device entitlement natively. No additional backend needed.

---

## 5. Complete System Architecture

### 5.1 Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Device                                   │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │   Main      │  │  Renderer   │  │   Store                 │   │
│  │  Process    │◄─┤  (UI)       │  │  (Encrypted Local)      │   │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘   │
│         │                │                      │                 │
│         │         ┌──────┴──────┐              │                 │
│         │         │  preload.ts │              │                 │
│         │         │ (IPC Bridge)│              │                 │
│         │         └──────┬──────┘              │                 │
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Managers                                  │  │
│  ├──────────────┬───────────────┬──────────────┬────────────┤  │
│  │ AccountMgr   │ IAPManager     │ NotifMgr     │ SyncMgr    │  │
│  │              │ (StoreKit)     │              │ (iCloud)   │  │
│  └──────────────┴───────────────┴──────────────┴────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ (via NSUbiquitousKeyValueStore)
                              ▼
                    ┌─────────────────────┐
                    │      iCloud         │
                    │  (mp_settings)      │
                    │  (mp_accounts)      │
                    └─────────────────────┘
                              │
                              │ (other devices)
                              ▼
                    ┌─────────────────────┐
                    │    Device B         │
                    │ (same Apple ID)     │
                    └─────────────────────┘
```

### 5.2 IPC Surface (updated)

```typescript
// New IPC handlers needed
ipcMain.handle('sync:push', (event, { key, value }) => syncManager.push(key, value));
ipcMain.handle('sync:pull', (event, key) => syncManager.pull(key));
ipcMain.on('sync:external-change', (event, { key, value }) => syncManager.handleExternalChange(key, value));

// Existing handlers that trigger sync
ipcMain.handle('settings:update', (event, patch) => {
  const result = settingsManager.update(patch);
  syncManager.push('mp_settings', result); // Push to iCloud
  return result;
});

ipcMain.handle('accounts:add', (event, label, email) => {
  const result = accountManager.add(label, email);
  syncManager.push('mp_accounts', accountManager.listAccounts()); // Push to iCloud
  return result;
});
```

---

## 6. User Flows

### 6.1 New Device Setup Flow

```
User installs MessengerPro on Mac #2
           │
           ▼
    Fresh app, no accounts
           │
           ▼
   iCloud sync detects
   "mp_accounts" has data
           │
           ▼
  SyncManager pulls accounts
  from iCloud
           │
           ▼
  Accounts restored (label, email, avatar)
           │
           ▼
  UI shows "Account A", "Account B"
           │
           ▼
  User clicks "Account A"
           │
           ▼
  BrowserView created with fresh partition
  (User must log in to Facebook)
           │
           ▼
  User logs in → session stored locally
           │
           ▼
  Account ready on Device #2
```

### 6.2 Subscription Restore Flow

```
User installs MessengerPro on new Mac
           │
           ▼
   App launches, checks entitlement
           │
           ▼
   isPremium = false (no cached entitlement)
           │
           ▼
   UI shows Free tier (1 account max)
           │
           ▼
   User clicks "Restore Purchases"
           │
           ▼
   StoreKit.restoreCompletedTransactions()
           │
           ▼
   Transactions found for this Apple ID
           │
           ▼
   handleTransaction() → unlockPremium()
           │
           ▼
   isPremium = true
           │
           ▼
   UI updates → unlimited accounts
```

### 6.3 Settings Sync Flow

```
User changes "Dark Theme" to "Light Theme" on Device A
           │
           ▼
   renderer → settings:update({ theme: 'light' })
           │
           ▼
   AccountManager.updateSettings({ theme: 'light' })
           │
           ▼
   Store.set('settings', updated)
           │
           ▼
   SyncManager.push('mp_settings', settingsSync)
           │
           ▼
   iCloud KVS updates → syncs to iCloud
           │
           ▼ (automatic, ~1-2 seconds later)
           │
           ▼
   Device B receives NSUbiquitousKeyValueStoreDidChangeExternallyNotification
           │
           ▼
   SyncManager.onExternalChange()
           │
           ▼
   Merge settings, Store.set()
           │
           ▼
   Notify renderer → re-render
           │
           ▼
   Device B now shows "Light Theme"
```

---

## 7. SyncManager Implementation

```typescript
// src/main/syncManager.ts
import { NSUbiquitousKeyValueStore } from './native/icloud';

interface SyncableData {
  settings?: AppSettingsSync;
  accounts?: AccountSync[];
  lastSync: number;
}

export class SyncManager {
  private store: Store;
  private localChangeInProgress = false;

  constructor(store: Store) {
    this.store = store;
    this.setupExternalChangeListener();
  }

  push(key: string, value: unknown): void {
    if (this.localChangeInProgress) return;

    NSUbiquitousKeyValueStore.default.set(key, JSON.stringify(value));
    NSUbiquitousKeyValueStore.default.synchronize();
  }

  pull<T>(key: string): T | null {
    const raw = NSUbiquitousKeyValueStore.default.stringForKey(key);
    return raw ? JSON.parse(raw) : null;
  }

  private setupExternalChangeListener(): void {
    // Listen for external changes via NotificationCenter
    // In Electron, this would be via a native module or NSNotification observer
    // For simplicity, we also poll on app activation
  }

  handleExternalChange(key: string, value: unknown): void {
    this.localChangeInProgress = true; // Prevent push-back loop

    // Merge with local data (last-write-wins + special handling for accounts)
    if (key === 'mp_settings') {
      this.mergeSettings(value as AppSettingsSync);
    } else if (key === 'mp_accounts') {
      this.mergeAccounts(value as AccountSync[]);
    }

    this.localChangeInProgress = false;
  }

  private mergeSettings(cloudSettings: AppSettingsSync): void {
    const local = this.store.get<AppSettings>('settings', {} as AppSettings);
    const merged = { ...local, ...cloudSettings };
    this.store.set('settings', merged);
    this.notifyRenderer('settings:updated', merged);
  }

  private mergeAccounts(cloudAccounts: AccountSync[]): void {
    const local = this.store.get<Account[]>('accounts', []);
    const localMap = new Map(local.map(a => [a.id, a]));
    const cloudMap = new Map(cloudAccounts.map(a => [a.id, a]));

    // Merge: prefer cloud for metadata, keep local for device-specific fields
    for (const [id, cloudAccount] of cloudMap) {
      const localAccount = localMap.get(id);
      if (!localAccount) {
        // New account from cloud - add locally
        local.push({
          ...cloudAccount,
          partition: `persist:account-${id}`, // New partition
          unreadCount: 0,
          lastUsed: cloudAccount.lastUsed,
        });
      } else {
        // Merge: cloud wins for metadata, local wins for runtime data
        localAccount.label = cloudAccount.label;
        localAccount.email = cloudAccount.email;
        localAccount.avatarColor = cloudAccount.avatarColor;
      }
    }

    this.store.set('accounts', local);
    this.notifyRenderer('accounts:updated', local);
  }
}
```

---

## 8. Edge Cases & Error Handling

### 8.1 Conflict Scenarios

| Scenario | Resolution |
|----------|------------|
| Same account labeled differently on 2 devices | Last-write-wins (cloud wins) |
| Account added on both devices | Keep both, user decides which to use |
| iCloud unavailable | App works fully offline, sync resumes when available |
| Sync fails mid-transfer | Retry on next change, no partial state |

### 8.2 Subscription Edge Cases

| Scenario | Behavior |
|----------|----------|
| Subscription expires | Grace period of 24h, then revert to free tier UI |
| Apple receipt fails to validate | Use cached entitlement, retry on next launch |
| User switches Apple ID | Old subscription doesn't transfer, must purchase again |
| Family sharing | Works automatically via StoreKit |
| Sandbox vs Production | Test purchases can be restored in production (Apple handles) |

### 8.3 iCloud Unavailable

If user is not signed into iCloud:
- App works 100% locally
- Settings/account metadata stay on device
- User can enable iCloud later to sync
- Show subtle indicator: "iCloud sync disabled" in settings

---

## 9. Security Considerations

### 9.1 What is NOT synced (intentionally)
- Facebook session cookies (device-bound, Meta security)
- OpenAI/Translate API keys (should be per-device or user-entered)
- Partition data (contains auth tokens)

### 9.2 What IS synced (safe)
- Account labels (user-chosen text)
- Email (optional, non-sensitive)
- Avatar colors (arbitrary strings)
- Theme preferences (no secrets)

### 9.3 Privacy

- iCloud data is encrypted by Apple
- No data leaves the user's iCloud ecosystem
- Meta never knows about the app's multi-device setup

---

## 10. Migration Path (Adding to Existing App)

### Phase 1: iCloud Sync Foundation
1. Create `SyncManager` class
2. Define `AppSettingsSync` and `AccountSync` types
3. Implement `push`/`pull` for settings
4. Implement `handleExternalChange`
5. Add conflict resolution for accounts

### Phase 2: Settings Sync
1. Update `settings:update` handler to push to iCloud
2. Update renderer to handle `settings:updated` from sync
3. Test sync between two devices

### Phase 3: Account Metadata Sync
1. Update `accounts:add` to push to iCloud
2. Update `accounts:remove` to push updated list
3. Handle account conflicts

### Phase 4: Visual Indicators
1. Add "Syncing..." indicator in settings
2. Show last sync time
3. Add "Sync now" button (manual trigger)
4. Handle offline gracefully

### Phase 5: Test & Polish
1. Test with 2 Macs, different Apple IDs
2. Test restore purchases on fresh install
3. Test conflict scenarios
4. Test offline behavior

---

## 11. Summary

| Feature | Technology | Cross-Device? |
|---------|-----------|---------------|
| Account metadata (label, email, avatar) | iCloud KVS | Yes |
| Settings (theme, sidebar, focus) | iCloud KVS | Yes |
| Subscription | StoreKit Restore | Yes (same Apple ID) |
| Facebook session | Local only | No (re-login required) |
| API keys | Local only | No (per-device) |
| Unread counts | Local only | No (computed locally) |

**User Experience:**
1. User sets up account labels on Device A
2. On Device B, labels appear automatically via iCloud
3. User logs into Facebook on Device B (once per account)
4. User subscribes on Device A
5. On Device B, "Restore Purchases" activates premium