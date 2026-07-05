# System Design: Apple ID Subscription Integration

## Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Launch    │ ──► │   Paywall   │ ──► │ Apple Sign │ ──► │     App     │
│             │     │ (Purchase)  │     │    -In     │     │  (Full UI)  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 1. Current Architecture Analysis

**What's already in place:**
- ✅ IAPManager with StoreKit integration
- ✅ Paywall UI at `src/renderer/components/Paywall.tsx`
- ✅ Premium check in App.tsx (lines 47-54)
- ✅ Local auth (username/password) via AuthManager
- ✅ Workspace/workspace accounts system
- ✅ electron-builder MAS config for App Store

**What's missing:**
- ❌ Sign in with Apple integration
- ❌ Proper App Store Connect subscription setup
- ❌ Flow: paywall → auth → app (currently: check sub → user login)

---

### 2. New Components to Create

#### A. `src/main/appleSignInManager.ts` (Main Process)
- Handle Sign in with Apple via `signInWithApple` npm package or native Node.js
- Store Apple credential state
- Validate Apple ID token with Apple servers
- Handle refresh tokens

**Key responsibilities:**
```typescript
class AppleSignInManager {
  // Initiate Sign in with Apple flow
  initiateSignIn(): Promise<{ identityToken: string; user: string }>

  // Verify credential with Apple
  verifyCredential(identityToken: string): Promise<AppleUser | null>

  // Store/retrieve user
  getCurrentUser(): AppleUser | null
  signOut(): void
}
```

#### B. `src/renderer/components/AppleSignIn.tsx` (Renderer)
- UI component for Sign in with Apple button
- Uses JS-only Sign in with Apple for web (appleid.auth.js)
- Or native implementation via IPC

**UI Flow:**
```
┌────────────────────────────────────────────┐
│                                            │
│   ┌──────┐   ┌──────┐   ┌──────┐         │
│   │ Pay  │ → │Subscr│ → │Apple │ → App  │
│   │wall  │   │Purch │   │SignIn│         │
│   └──────┘   └──────┘   └──────┘         │
│                                            │
└────────────────────────────────────────────┘
```

#### C. Modified `App.tsx` Flow
**Current:**
```
Launch → Check Premium → (if no) Show Paywall → (if yes) User Login → App
```

**New:**
```
Launch → Check Premium → (if no) Show Paywall → (if yes) Apple Sign-In → App
```

---

### 3. Data Flow

#### A. Launch Flow (Main Process)
```typescript
// main.ts - app.whenReady()
1. Store recovery
2. IAPManager.initialize()
3. Check isPremium from Store
4. If !isPremium → Renderer shows Paywall
5. If isPremium → Check Apple Sign-In state
6. If no Apple user → Renderer shows AppleSignIn
7. If Apple user exists → Load workspaces → Show App
```

#### B. Purchase Flow
```typescript
// Existing IAP flow stays the same:
// 1. User selects plan → purchaseProduct()
// 2. StoreKit transaction → handleTransaction()
// 3. verifyReceiptWithApple()
// 4. unlockPremium(productId) → set isPremium=true
// 5. Notify renderer → reload → Show Apple Sign-In
```

#### C. Apple Sign-In Flow
```typescript
// 1. User clicks "Sign in with Apple"
// 2. Native Sign in with Apple sheet appears (or JS redirect)
// 3. Apple returns: { identityToken, authorizationCode, user }
// 4. Store: { appleUserId, email, name }
// 5. On success → Show App with workspaces
```

---

### 4. Required Changes (File by File)

#### `src/shared/constants.ts`
- Add Apple Sign-In related constants (if needed)
- Keep existing IAP_PRODUCTS (already correct)

#### `src/shared/types.ts`
- Add new type for Apple user:
```typescript
export interface AppleUser {
  id: string;           // Apple user ID (subject)
  email?: string;       // Only if email scope requested
  name?: string;       // Only if name scope requested
  identityToken: string;
  authorizationCode: string;
}
```

#### `src/main/appleSignInManager.ts` (NEW)
- Handle Sign in with Apple
- Store Apple credentials in electron-store
- IPC handlers for renderer communication

#### `src/main/preload.ts`
- Add Apple Sign-In API to electronAPI:
```typescript
appleSignIn: {
  signIn: () => Promise<AppleUser | { error: string }>
  getCurrentUser: () => Promise<AppleUser | null>
  signOut: () => Promise<void>
}
```

#### `src/main/main.ts`
- Create AppleSignInManager instance
- Add IPC handlers for appleSignIn
- Modify launch flow to check Apple auth after premium

#### `src/renderer/App.tsx`
- Replace ICloudLogin with AppleSignIn component
- Modify flow:
  - `!isPremium` → Paywall
  - `isPremium && !appleUser` → Apple Sign-In
  - `isPremium && appleUser` → Full app

#### `src/renderer/components/AppleSignIn.tsx` (NEW)
- Sign in with Apple button
- Handle callback
- Show error states

#### `src/renderer/store/` (NEW or modify)
- `appleUserStore.ts` - Zustand store for Apple user state

#### `package.json`
- Add `sign-in-with-apple` package for JS implementation OR use native approach

---

### 5. StoreKit 2 / App Store Requirements

To be App Store compliant:

1. **Subscription Products in App Store Connect:**
   - Create 3 subscriptions: monthly, yearly, lifetime
   - Set up App Store Connect subscription configuration
   - Configure pricing (already have the right prices)

2. **Receipt Handling:**
   - Current implementation uses legacy StoreKit (receipts)
   - Consider upgrading to **StoreKit 2** (in-app purchases API) for:
     - Better server-side validation
     - Transaction history
     - App Store server notifications support

3. **Required App Store Connect Setup:**
   - Sign in with Apple capability enabled
   - In-App Purchase capability enabled
   - Privacy manifest with Sign in with Apple usage description
   - App Store Connect: Add subscription products

4. **Testing:**
   - Use App Store Connect Sandbox
   - Test Sign in with Apple in Sandbox
   - Test subscription purchases with Sandbox account

---

### 6. Security Considerations

1. **Sign in with Apple:**
   - Verify identityToken with Apple's auth endpoint
   - Store only Apple user ID (don't trust client-provided ID)
   - Use authorizationCode for server-side validation

2. **IAP:**
   - Already has receipt validation (good)
   - Consider: Add App Store Server Notifications for subscription lifecycle events
   - Handle subscription expiration gracefully

3. **Data Storage:**
   - Apple user data in electron-store (encrypted)
   - Subscription state in same store

---

### 7. Summary of Work

| Component | Type | Description |
|-----------|------|-------------|
| `appleSignInManager.ts` | New (Main) | Handle Sign in with Apple |
| `AppleSignIn.tsx` | New (Renderer) | UI for Apple Sign-In |
| `App.tsx` | Modify | Change flow: Paywall → Apple Sign-In |
| `preload.ts` | Modify | Add appleSignIn API |
| `main.ts` | Modify | Add AppleSignInManager, IPC |
| `types.ts` | Modify | Add AppleUser type |
| `package.json` | Modify | Add sign-in-with-apple package |

---

## Appendix: Pricing Summary

| Plan | Price | Product ID |
|------|-------|------------|
| Monthly | $2.99/month | `com.appsforfacebook.app.premium_monthly` |
| Yearly | $6.99/year | `com.appsforfacebook.app.premium_yearly` |
| Lifetime | $14.99 | `com.appsforfacebook.app.premium_lifetime` |

---

## Appendix: Launch Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APP LAUNCH                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Store Recovery                                                           │
│     - Load settings from electron-store                                      │
│     - Check isPremium, premiumExpiresAt                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. IAPManager.initialize()                                                 │
│     - Register transaction-updated listener                                  │
│     - Can check canMakePayments()                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  isPremium?          │
                         └─────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │ No                           │ Yes
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────────────┐
│    SHOW PAYWALL         │     │  Check Apple Sign-In State              │
│    - User buys sub      │     │  (from electron-store)                   │
│    - unlockPremium()    │     └─────────────────────────────────────────┘
│    - reload             │                    │
│                         │                    ▼
└─────────────────────────┘    ┌─────────────────────────────────────────┐
                                │  appleUser exists?                       │
                                └─────────────────────────────────────────┘
                                     │
                    ┌───────────────┴───────────────┐
                    │ No                           │ Yes
                    ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────────────┐
│  SHOW APPLE SIGN-IN      │     │  SHOW FULL APP                          │
│  - User signs in         │     │  - Load workspaces                      │
│  - Store apple user     │     │  - Load accounts                         │
│  - Show app             │     │  - Show BrowserView                      │
└─────────────────────────┘     └─────────────────────────────────────────┘
```

---

## Appendix: IAP Purchase Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          USER PURCHASE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

User on Paywall
      │
      ▼
User clicks plan (e.g., Monthly $2.99)
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  renderer: window.electronAPI.iap.purchase(productId)                       │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  main: iapManager.purchaseProduct(productId)                               │
│  - inAppPurchase.getProducts([productId])                                  │
│  - inAppPurchase.purchaseProduct(productId)                               │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  StoreKit processes payment                                                 │
│  - User sees payment sheet (Apple ID)                                      │
│  - Payment succeeds/fails                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Event: inAppPurchase.on('transactions-updated')                          │
│  Handle transaction:                                                       │
│    - State: 'purchased' or 'restored'                                      │
│    - Call verifyReceiptWithApple()                                        │
│    - If valid: unlockPremium(productId)                                    │
│    - finishTransactionByDate()                                            │
│    - notifyRenderer('premium-unlocked')                                   │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  renderer: onPremiumUnlocked(productId)                                    │
│  - toast.success("Purchase successful!")                                   │
│  - updateSettings({ isPremium: true })                                    │
│  - setTimeout(() => window.location.reload(), 1500ms)                     │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
On reload: isPremium = true → proceeds to Apple Sign-In
```

---

## Appendix: Receipt Validation Details

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      APPLE RECEIPT VALIDATION                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. Get receipt URL
   const receiptURL = inAppPurchase.getReceiptURL();

2. Read receipt data
   const receiptData = fs.readFileSync(receiptURL).toString('base64');

3. Send to Apple (production first)
   POST https://buy.itunes.apple.com/verifyReceipt
   Body: { "receipt-data": receiptData }

4. Handle response:
   - status === 0: Valid → Unlock premium
   - status === 21007: Sandbox receipt → Verify with sandbox server
   - Other status: Invalid → Don't unlock

5. Offline fallback:
   - If network fails, trust StoreKit's 'purchased' state
   - (StoreKit only sends 'purchased' after Apple verifies)
```