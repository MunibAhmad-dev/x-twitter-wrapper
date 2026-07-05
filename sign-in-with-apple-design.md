# Sign in with Apple - UX Design Document

## 1. Screen Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER FLOW DIAGRAM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│   │  Splash  │────▶│ Welcome  │────▶│  Apple   │────▶│  Sync    │          │
│   │  Screen  │     │  Screen  │     │   OAuth  │     │  Check   │          │
│   └──────────┘     └──────────┘     └──────────┘     └────┬─────┘          │
│         │                                              │                  │
│         │                                              ▼                  │
│         │            ┌────────────────────────────────────────┐          │
│         │            │        SUBSCRIPTION CHECK              │          │
│         │            │  ┌─────────────┐    ┌──────────────┐    │          │
│         │            │  │  Premium ✓  │    │   Free Tier │    │          │
│         │            │  └──────┬──────┘    └──────┬───────┘    │          │
│         │            └─────────┼──────────────────┼────────────┘          │
│         │                      │                  │                       │
│         │                      ▼                  ▼                       │
│         │            ┌─────────────────┐  ┌─────────────────┐           │
│         │            │   Main App       │  │   Main App      │           │
│         │            │   (Pro Features) │  │   (Free Limits) │           │
│         │            └────────┬────────┘  └────────┬────────┘           │
│         │                     │                  │                        │
│         │                     ▼                  ▼                        │
│         │            ┌─────────────────┐  ┌─────────────────┐           │
│         │            │ Onboarding      │  │ Upgrade Prompt  │           │
│         │            │ (Create Space)  │  │ (Optional)      │           │
│         │            └─────────────────┘  └─────────────────┘           │
│         │                                                       │
│         │  ┌──────────┐     ┌──────────┐                           │
│         └─▶│  Main    │◀────│ Settings │                           │
│             │   App   │     │  Panel   │                           │
│             └──────────┘     └──────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Screen Details

### 2.1 Splash Screen (1-2 seconds)

**Behavior:**
- Show app icon + name
- Loading indicator
- Auto-transition to Welcome Screen

---

### 2.2 Welcome Screen (First Launch)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                           💬                                   │
│                                                                │
│                     Welcome to                                │
│                     MessengerPro                              │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    Sign in with Apple                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Continue without signing in                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  By signing in, you can sync your workspaces and             │
│  preferences across all your Macs.                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**UI Elements:**
- **Primary Button:** "Sign in with Apple" - Full width, Apple black style
- **Secondary Button:** "Continue without signing in" - Subtle, gray outline
- **Helper Text:** Below buttons explaining benefits
- **Privacy Note:** Small text: "Apple handles your data securely"

---

### 2.3 Apple OAuth Dialog

**Behavior:**
- This is Apple's system dialog (Sign in with Apple)
- User chooses email visibility
- On success, we receive Apple ID token
- On failure, return to Welcome Screen with error

---

### 2.4 Syncing Screen (After Sign In)

**What happens:**
1. Fetch Apple ID info → Store locally
2. Query iCloud for `mp_settings` → Merge with local
3. Query iCloud for `mp_workspaces` → Merge with local
4. Check StoreKit for active subscription

---

### 2.5 Subscription Check (Critical)

**Premium Check Logic:**
```typescript
async function checkPremiumStatus(): Promise<PremiumStatus> {
  // 1. Check local cache first (fast)
  const cached = store.get('premiumCache');
  if (cached && isValid(cached)) {
    return cached;
  }

  // 2. Query StoreKit for active transactions
  const transactions = await storeKit.getActiveTransactions();

  // 3. Validate each transaction
  for (const tx of transactions) {
    if (isValidSubscription(tx)) {
      const status = {
        isPremium: true,
        productId: tx.productId,
        expiresAt: tx.expiresAt,
        source: 'storekit'
      };
      store.set('premiumCache', status);
      return status;
    }
  }

  // 4. Not premium
  return { isPremium: false, source: 'none' };
}
```

---

### 2.6 Onboarding (First Workspace)

**UX Considerations:**
- Pre-populated with common options (Work, Personal)
- Live preview of workspace card
- Skip option for users who want to explore on their own

---

### 2.7 Main App (Post-Login)

**Key UI Elements:**
- User avatar in sidebar (shows Apple ID name)
- Premium badge if Pro: "Pro" next to username
- Workspace list with sync status indicators

---

### 2.8 Settings - Account & Subscription

**Sections:**
1. Account - Apple ID info, Sign Out
2. Subscription - Current plan, expiry, manage/restore
3. iCloud Sync - Sync status, manual sync button

---

## 3. Premium Features Detail

| Feature | Free | Pro |
|---------|------|-----|
| Workspaces | 1 | Unlimited |
| Accounts per workspace | 1 | Unlimited |
| Workspace icons/colors | Default only | Full customization |
| iCloud sync | Basic | Full |
| Priority support | - | Future |

---

## 4. IAP Implementation Details

### 4.1 StoreKit Integration

**Products to create in App Store Connect:**
- `com.messengerpro.app.premium_monthly` - $2.99/month
- `com.messengerpro.app.premium_yearly` - $19.99/year (save ~44%)

### 4.2 Testing IAP on Linux

On Linux, purchases are AUTOMATICALLY simulated (dev mode):
- Premium unlocks instantly without actual payment
- Lets you test: upgrade UI, feature gating, account limits

---

## 5. Data Storage Structure

### 5.1 Local Storage (encrypted)

```typescript
interface StoredData {
  // User info (from Sign in with Apple)
  user: {
    appleId: string;
    email: string;
    name: string;
    token: string;
  };

  // Settings (synced to iCloud)
  settings: AppSettings;

  // Subscription
  subscription: {
    isPremium: boolean;
    productId: string;
    expiresAt: number;
    source: 'storekit' | 'dev';
  };

  // Workspaces (synced to iCloud)
  workspaces: Workspace[];
}
```

### 5.2 iCloud Key-Value Store Keys

```
mp_settings    → JSON of { theme, sidebarExpanded, focusMode, ... }
mp_workspaces → JSON of [{ id, name, icon, color }, ...]
mp_last_sync  → timestamp
```

---

## 6. Cross-Device Scenario Table

| Scenario | What Happens |
|----------|--------------|
| New Mac, same Apple ID, has subscription | Auto-detect premium via StoreKit |
| New Mac, same Apple ID, no subscription | Show free tier, offer upgrade |
| New Mac, different Apple ID | Must purchase separately |
| Offline launch | Use cached entitlement, show "Last checked: X" |
| Subscription expires | Grace period 24h, then revert to free |

---

## 7. Implementation Tasks

### New Files
| File | Purpose |
|------|---------|
| `src/main/appleSignIn.ts` | Handle Sign in with Apple OAuth |
| `src/main/cloudSyncManager.ts` | iCloud Key-Value sync |
| `src/main/entitlementManager.ts` | Centralized premium check |

### Modify
| File | Changes |
|------|---------|
| `src/main/main.ts` | Integrate Apple Sign In, CloudSync, Entitlement |
| `src/renderer/components/ICloudLogin.tsx` | New UI: Welcome → OAuth → Onboarding |
| `src/renderer/store/uiStore.ts` | Add Apple user state |
| `src/shared/types.ts` | Add AppleUser, PremiumStatus types |

---

## 8. Questions

1. Onboarding: Required or optional?
2. Guest mode: What happens if user skips sign in?
3. Premium expiry warning?
4. Test dev mode premium on Linux?