# Apps for Instagram — Migration Report

## Summary

The existing "Apps for Facebook & Messenger" codebase has been fully migrated to "Apps for Instagram". All user-facing text, URLs, identifiers, and design elements have been updated. Core productivity features (AI Reply, Translation, Focus Mode, Analytics, etc.) are fully preserved.

---

## 1. FILES MODIFIED

| File | Changes |
|------|---------|
| `src/shared/constants.ts` | App name, all URLs, Bundle ID, IAP products, allowed hosts, avatar colors, localStorage key |
| `src/renderer/index.html` | Document title |
| `src/renderer/index.css` | Primary color changed to Instagram pink/purple palette; scrollbar accent color |
| `src/renderer/App.tsx` | Account creation label, comment |
| `src/renderer/components/SplashScreen.tsx` | Full redesign with Instagram gradient (purple → pink → orange) |
| `src/renderer/components/Sidebar/Sidebar.tsx` | App label, sidebar background tint, avatar comment |
| `src/renderer/components/Dashboard/Dashboard.tsx` | Account labels, empty state icon, help text |
| `src/renderer/components/WorkspaceView.tsx` | No user-visible changes (generic) |
| `src/renderer/components/Paywall.tsx` | Account creation labels, compliance comment |
| `src/renderer/components/Modals/DisclaimerModal.tsx` | Full rewrite for Instagram disclaimer |
| `src/renderer/components/Modals/PreferencesModal.tsx` | App name, disclaimer text, support URLs |
| `src/renderer/components/Modals/CreateWorkspaceModal.tsx` | Account label, description text |
| `src/renderer/components/Premium/QuickReplyComposer.tsx` | All "Messenger" → "Instagram DM/Direct" toast messages and button labels |
| `src/renderer/components/Premium/MessageSchedulerPanel.tsx` | All "Messenger" → "Instagram Direct" toast messages and descriptions |
| `src/renderer/components/MessagingToolbar.tsx` | Toast messages updated |
| `src/renderer/store/workspaceStore.ts` | Placeholder account name set, identity key prefix |
| `src/main/main.ts` | Profile refresh DOM selectors (Instagram-specific), account label, allowed URLs for shell.openExternal |
| `src/main/menuBuilder.ts` | Help menu URLs (Facebook → Instagram help/privacy) |
| `src/main/messengerPreload.ts` | Header comment |
| `src/main/authManager.ts` | Avatar color palette (Instagram brand colors), comment |
| `package.json` | App name, description, author, build:pkg script paths |
| `electron-builder.yml` | App ID, product name, copyright, DMG title |

---

## 2. URL CHANGES

| Before | After |
|--------|-------|
| `https://www.facebook.com` | `https://www.instagram.com` |
| `https://www.facebook.com/messages` | `https://www.instagram.com/direct/inbox/` |
| `https://www.facebook.com/settings?tab=language` | `https://www.instagram.com/accounts/language/` |
| `https://www.facebook.com/notifications` | `https://www.instagram.com/direct/inbox/` |
| `https://www.facebook.com/help` | `https://help.instagram.com` |
| `https://www.facebook.com/privacy/policy` | `https://privacycenter.instagram.com/policy` |

---

## 3. IDENTIFIER CHANGES

### Bundle ID
- **Before:** `com.graure.appsforfacebookandmessenger`
- **After:** `com.graure.appsforinstagram`

### IAP Products (App Store Connect)
| Identifier | Description |
|-----------|-------------|
| `com.graure.appsforinstagram.premium_monthly` | Auto-Renewable Subscription — Monthly |
| `com.graure.appsforinstagram.premium_yearly` | Auto-Renewable Subscription — Yearly |
| `com.graure.appsforinstagram.premium_lifetime` | Non-Consumable — Lifetime |

### Storage Keys
| Type | Before | After |
|------|--------|-------|
| localStorage (Quick Reply) | `msgw_quick_reply_drafts` | `igw_quick_reply_drafts` |
| Electron Store file | `app-data.bin` | `app-data.bin` (unchanged — isolated by userData dir) |
| Session partitions | `persist:workspace-account-<uuid>` | `persist:workspace-account-<uuid>` (isolated per install) |

### Allowed Hosts (Navigation Allowlist)
- **Removed:** `messenger.com`, `www.messenger.com`, `facebook.com`, `www.facebook.com`, `m.facebook.com`, `staticxx.facebook.com`, `static.xx.fbcdn.net`, `connect.facebook.net`
- **Added:** `instagram.com`, `www.instagram.com`, `i.instagram.com`, `cdninstagram.com`, `scontent.cdninstagram.com`, `static.cdninstagram.com`

---

## 4. DESIGN CHANGES

### Color System (index.css)
| Token | Before (Facebook Blue) | After (Instagram Purple-Pink) |
|-------|----------------------|-------------------------------|
| `--primary` (light) | `221.2 83.2% 53.3%` | `317 57% 45%` |
| `--primary` (dark) | `217.2 91.2% 59.8%` | `317 65% 62%` |
| `--ring` | Facebook blue | Instagram pink |
| Scrollbar accent | Gray | Instagram pink `rgba(193, 53, 132, ...)` |

### Splash Screen
- **Before:** Solid Facebook blue gradient (`#1877F2 → #06357a`)
- **After:** Instagram signature gradient (`#405DE6 → #833ab4 → #C13584 → #E1306C → #F77737`)
- Added two decorative blurred ambient circles (Instagram vibe)
- Subtitle line "Multi-account workspace" added

### Sidebar Background
- **Before:** `#f8f9fb` (neutral gray) / `#0f1117` (dark)
- **After:** `#fdf8fc` (warm pink-tint) / `#0f0a12` (warm dark)

### Avatar Colors
- **Before:** Blue, teal, red, purple, orange, green, blue, pink
- **After:** Instagram brand palette: `#833ab4`, `#C13584`, `#E1306C`, `#F77737`, `#FCAF45`, `#5851DB`, `#405DE6`, teal

---

## 5. STORAGE ISOLATION

The Instagram app is isolated from the Facebook app by:

1. **Different `userData` directory** — macOS uses Bundle ID for `~/Library/Application Support/`. With a new Bundle ID (`com.graure.appsforinstagram`), all app data lands in a separate directory.
2. **Different Store file** — `app-data.bin` in the new userData path is completely separate.
3. **Session partitions** — Already UUID-based, no overlap possible.
4. **localStorage key changed** — `igw_quick_reply_drafts` vs `msgw_quick_reply_drafts`.

---

## 6. APP STORE CONNECT CHECKLIST

These items must be created/updated in App Store Connect before submission:

### New App Record
- [ ] Create new app: **"Apps for Instagram"**
- [ ] Bundle ID: `com.graure.appsforinstagram`
- [ ] SKU: `appsforinstagram`
- [ ] Primary language: English (US)
- [ ] Category: Social Networking / Productivity

### In-App Purchases
- [ ] Create Auto-Renewable Subscription: `com.graure.appsforinstagram.premium_monthly`
- [ ] Create Auto-Renewable Subscription: `com.graure.appsforinstagram.premium_yearly`
- [ ] Create Non-Consumable: `com.graure.appsforinstagram.premium_lifetime`
- [ ] Set IAP shared secret in `IAP_SHARED_SECRET` env var

### Provisioning / Signing
- [ ] Create new App ID: `com.graure.appsforinstagram`
- [ ] Create new Provisioning Profile for the new App ID
- [ ] Update `electron-builder.yml → mas.provisioningProfile` to new `.provisionprofile`
- [ ] Update entitlements `.plist` files with new bundle ID if hardcoded

### App Icons
- [ ] Replace `assets/icon.png` with Instagram-themed app icon
- [ ] Replace `src/renderer/public/logo.png` with Instagram-themed icon

---

## 7. APP STORE METADATA

### App Name
**Apps for Instagram**

### Subtitle
**Multi-Account DM Workspace**

### Promotional Text
Manage all your Instagram accounts from one beautiful macOS app. Switch accounts instantly, reply smarter with AI, and never miss a DM.

### Description
**Apps for Instagram** is the ultimate multi-account desktop workspace for Instagram power users on macOS.

**Key Features:**
• **Multi-Account Management** — Add and switch between unlimited Instagram accounts seamlessly
• **AI Reply Assistant** — Generate smart, context-aware reply suggestions in 4 tones (Professional, Friendly, Casual, Concise)
• **AI Translation** — Translate messages into 14 languages instantly
• **Message Scheduler** — Plan DMs with countdowns and one-click send
• **Focus / Do Not Disturb** — Block all notifications during scheduled focus sessions
• **Smart Filters** — Organize accounts by type: Unread, Business, Personal, Flagged
• **Analytics Dashboard** — Track unread counts and account activity over time
• **Notification History** — Full log of every notification received
• **Theme Customizer** — Accent colors, text size, and layout density
• **Command Palette (⌘K)** — Lightning-fast keyboard navigation
• **Quick Reply Composer** — Type replies natively and inject directly into Instagram DMs
• **Keyboard Shortcuts** — Navigate the app at the speed of thought

**Disclaimer:** Apps for Instagram is an independent, third-party application not affiliated with, endorsed by, or connected to Meta Platforms, Inc. or Instagram. Instagram® is a trademark of Meta Platforms, Inc.

### Keywords
Instagram, DM, Direct Message, Multi Account, Productivity, Workspace, macOS

---

## 8. ASSETS REQUIRING REPLACEMENT

| Asset | Path | Status |
|-------|------|--------|
| App icon | `assets/icon.png` | ⚠️ Replace with Instagram-themed icon |
| Renderer logo | `src/renderer/public/logo.png` | ⚠️ Replace with Instagram-themed icon |
| Tray icon | Inline base64 in `src/main/main.ts:997` | ⚠️ Replace with Instagram-appropriate icon |

---

## 9. REMAINING INTERNAL REFERENCES (Non-User-Visible)

These are **internal implementation identifiers** — not user-visible. They function correctly and do not require renaming for user experience, but may be cleaned up in a future refactor:

| Identifier | Location | Notes |
|-----------|----------|-------|
| `messengerView` variable | `main.ts` | Internal BrowserView variable name |
| `createFacebookView()` | `main.ts` | Internal function name |
| `createMessengerView()` | `main.ts` | Legacy wrapper function |
| `repositionMessengerView()` | `main.ts` | Internal layout function |
| `refreshFacebookAccountProfile()` | `main.ts` | Internal profile sync — logic updated for Instagram DOM |
| `scheduleFacebookProfileRefresh()` | `main.ts` | Internal scheduling — URL check updated to instagram.com |
| IPC channel: `workspace:loadFacebook` | `main.ts`, `preload.ts`, renderer | Internal IPC name; Instagram URL is loaded |
| IPC channel: `browser:loadFacebook` | `main.ts`, `preload.ts` | Internal IPC name |
| IPC channel: `browser:loadMessenger` | `main.ts`, `preload.ts` | Loads `MESSENGER_CHAT_URL` (now Instagram DMs) |
| IPC channel: `messenger:unread-count` | `messengerPreload.ts`, `main.ts` | Internal IPC name |
| IPC channel: `messenger:notification` | `messengerPreload.ts`, `main.ts` | Internal IPC name |
| TypeScript API: `workspace.loadFacebook()` | `electron.d.ts` | TypeScript interface method name |

---

## 10. PROFILE AUTO-SYNC

The Instagram profile refresh JavaScript injection has been updated from Facebook-specific DOM selectors to Instagram-specific ones:

- **Name extraction:** Looks for `full_name`, `name`, `username` in page scripts
- **Avatar extraction:** Looks for `profile_pic_url_hd`, `profile_pic_url`, CDN URLs matching `cdninstagram.com`
- **CDN filter:** Changed from `fbcdn|scontent` to `cdninstagram|scontent`
- **Usable name filter:** Changed from Facebook UI keywords to Instagram UI keywords (`instagram`, `explore`, `reels`, `direct`, etc.)

---

*Migration completed. All user-facing text, URLs, colors, and identifiers have been updated for the Instagram app.*
