# Mac App Store Distribution Guide

> Complete step-by-step instructions for building, signing, and submitting
> **Apps for Facebook and Messenger** to the Mac App Store.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Certificate Setup](#2-certificate-setup)
3. [Provisioning Profile Setup](#3-provisioning-profile-setup)
4. [Environment Variables](#4-environment-variables)
5. [Local Build (on your Mac)](#5-local-build-on-your-mac)
6. [GitHub Actions (CI/CD)](#6-github-actions-cicd)
7. [Submitting to App Store Connect](#7-submitting-to-app-store-connect)
8. [In-App Purchase Setup](#8-in-app-purchase-setup)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Item | Status |
|------|--------|
| Apple Developer Account (paid, $99/year) | ✅ Required |
| Bundle ID: `com.graure.appsforfacebookandmessenger` | ✅ Registered |
| Team ID: `L284ZYR49L` | ✅ Configured |
| .p12 Certificate: `Final-Certificates.p12` | ✅ In repository root |
| Provisioning Profile: `Electron_App_Store_profile.provisionprofile` | ✅ In repository root |
| Apple ID: `grauremihai439@icloud.com` | ✅ Configured |
| App-Specific Password: `iksn-tixw-fvjl-qkco` | ✅ Generated |
| Node.js 20+ | Required for build |
| macOS machine (for signing) | Required — code signing only works on macOS |

---

## 2. Certificate Setup

### Installing the .p12 Certificate on Your Mac

1. **Double-click** `Final-Certificates.p12` in the repository root
2. macOS Keychain Access will open
3. Select **"login"** keychain (default)
4. Enter the certificate password when prompted
5. Click **"Add"**

### Verify Installation

Open Terminal and run:

```bash
security find-identity -v -p codesigning
```

You should see entries like:
```
"3rd Party Mac Developer Application: Your Name (L284ZYR49L)"
"3rd Party Mac Developer Installer: Your Name (L284ZYR49L)"
```

> **Note:** For MAS builds you need TWO certificates:
> - `3rd Party Mac Developer Application` — signs the .app
> - `3rd Party Mac Developer Installer` — signs the .pkg
>
> Both should be in your .p12 file. If not, export both from Keychain Access
> into a single .p12 or configure them separately.

---

## 3. Provisioning Profile Setup

### For Local Builds

The provisioning profile is already referenced in `electron-builder.yml`:
```yaml
provisioningProfile: Electron_App_Store_profile.provisionprofile
```

electron-builder will automatically embed it during the build.

### Manual Installation (optional)

If you need to install it system-wide:

```bash
mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
cp Electron_App_Store_profile.provisionprofile ~/Library/MobileDevice/Provisioning\ Profiles/
```

---

## 4. Environment Variables

### Required for Builds

Set these before running build commands:

```bash
# Path to the .p12 certificate (for electron-builder)
export CSC_LINK="$(pwd)/Final-Certificates.p12"

# Password for the .p12 certificate
export CSC_KEY_PASSWORD="Khan@123"

# For DMG notarization (NOT needed for MAS)
export APPLE_ID="grauremihai439@icloud.com"
export APPLE_APP_SPECIFIC_PASSWORD="iksn-tixw-fvjl-qkco"
export APPLE_TEAM_ID="L284ZYR49L"
```

### Persist Across Sessions (optional)

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
export APPLE_ID="grauremihai439@icloud.com"
export APPLE_APP_SPECIFIC_PASSWORD="iksn-tixw-fvjl-qkco"
export APPLE_TEAM_ID="L284ZYR49L"
```

Then reload: `source ~/.zshrc`

---

## 5. Local Build (on your Mac)

### Install Dependencies

```bash
npm install
```

### Build for Mac App Store

```bash
# Set signing variables first
export CSC_LINK="$(pwd)/Final-Certificates.p12"
export CSC_KEY_PASSWORD="Khan@123"

# Build MAS .pkg
npm run build:mas
```

The output will be in `release/` directory:
- `release/*.pkg` — The installer package for App Store submission
- `release/mas-universal/` — The signed .app bundle

### Build DMG (Direct Distribution - Signed & Notarized)

```bash
# Set code signing and notarization variables
export CSC_LINK="$(pwd)/Final-Certificates.p12"
export CSC_KEY_PASSWORD="Khan@123"
export APPLE_ID="grauremihai439@icloud.com"
export APPLE_APP_SPECIFIC_PASSWORD="iksn-tixw-fvjl-qkco"
export APPLE_TEAM_ID="L284ZYR49L"

npm run build:dmg
```

### Build Unsigned DMG (For Quick Client Testing - Recommended)

If you or your client want to quickly test the `.dmg` package locally without needing or importing certificates, you can disable macOS code signing entirely to produce an **unsigned DMG**:

```bash
# Disable code signing for this build
export CSC_IDENTITY_AUTO_DISCOVERY=false

# Build DMG
npm run build:dmg
```

> 💡 **Note for Client:** Since this DMG is unsigned, when your client opens it, macOS Gatekeeper will block it with a warning. They can easily bypass this by **Right-Clicking** the app in `Applications`, choosing **Open**, and then clicking **Open** on the prompt.

### Build Both

```bash
npm run build:all
```

### Test MAS Build in Sandbox

```bash
npm run build:mas-dev
```

This builds a `mas-dev` target which you can run locally without App Store submission.

---

## 6. GitHub Actions (CI/CD)

### Required GitHub Secrets

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|-------------|-------|
| `CSC_LINK` | Base64-encoded .p12 certificate (see below) |
| `CSC_KEY_PASSWORD` | Password for the .p12 certificate |
| `APPLE_ID` | `grauremihai439@icloud.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | `iksn-tixw-fvjl-qkco` |
| `APPLE_TEAM_ID` | `L284ZYR49L` |
| `PROVISIONING_PROFILE_BASE64` | Base64-encoded provisioning profile (optional) |

### Encoding the .p12 as Base64

```bash
base64 -i Final-Certificates.p12 | pbcopy
```

This copies the base64 string to your clipboard. Paste it as the `CSC_LINK` secret.

### Encoding the Provisioning Profile (optional)

```bash
base64 -i Electron_App_Store_profile.provisionprofile | pbcopy
```

Paste as `PROVISIONING_PROFILE_BASE64`. If this secret is not set, the workflow
falls back to using the file from the repository.

### Triggering a Build

- **Automatic:** Push to `main` or `master`
- **Manual:** Go to Actions → "Build macOS" → "Run workflow"

### Downloading Artifacts

After the workflow completes:
1. Go to the workflow run page
2. Scroll to "Artifacts"
3. Download `macos-mas-pkg`

---

## 7. Submitting to App Store Connect

### Using Transporter (Recommended)

1. Download **Transporter** from the Mac App Store (free)
2. Sign in with `grauremihai439@icloud.com`
3. Click **"+"** (Add App)
4. Select the `.pkg` file from `release/` directory
5. Click **"Deliver"**
6. Wait for processing (usually 5-15 minutes)

### Using xcrun (Command Line)

```bash
xcrun altool --upload-app \
  --type macos \
  --file release/*.pkg \
  --apiKey YOUR_API_KEY \
  --apiIssuer YOUR_ISSUER_ID
```

### After Upload

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. The new build should appear under **"TestFlight"** or **"App Store"** tab
4. Fill in the required metadata (screenshots, description, etc.)
5. Submit for review

---

## 8. In-App Purchase Setup

### Product IDs (must match App Store Connect)

| Product ID | Type | Price |
|------------|------|-------|
| `com.graure.appsforfacebookandmessenger.premium_monthly` | Auto-Renewable Subscription | $2.99/month |
| `com.graure.appsforfacebookandmessenger.premium_yearly` | Auto-Renewable Subscription | $6.99/year |
| `com.graure.appsforfacebookandmessenger.premium_lifetime` | Non-Consumable | $14.99 one-time |

### Setting Up in App Store Connect

1. Go to **App Store Connect → Your App → Features → In-App Purchases**
2. Click **"+"** to add each product
3. For subscriptions, create a **Subscription Group** first (e.g., "Premium")
4. Add monthly and yearly as auto-renewable subscriptions in that group
5. Add lifetime as a Non-Consumable purchase
6. Set pricing for each product
7. Add localized display names and descriptions
8. **Important:** Submit each IAP for review alongside the app

### Free Trial Configuration

For the 3-day free trial on monthly/yearly:
1. Edit the subscription in App Store Connect
2. Under "Subscription Prices," click "Introductory Offers"
3. Set: Free trial, 3 days
4. This is configured on Apple's side — the app code already handles it

---

## 9. Troubleshooting

### "Cannot find valid '3rd Party Mac Developer Installer' identity to sign MAS installer"

For Mac App Store (MAS) submissions, Apple requires **two different certificates**:
1. **3rd Party Mac Developer Application**: Used to sign the `.app` package bundle.
2. **3rd Party Mac Developer Installer**: Used to sign the `.pkg` installer wrapper that gets uploaded to Apple.

If you encounter this error:
- **Root Cause**: Your `Final-Certificates.p12` file only contains the "Application" certificate and is missing the "Installer" certificate.
- **Solution**: Ask your client to go to their Mac's **Keychain Access**, select both **"3rd Party Mac Developer Application"** and **"3rd Party Mac Developer Installer"** under the Team ID `L284ZYR49L`, export them together as a new `.p12` file, and send it to you.

---

### "Cannot find valid 'Developer ID Application' identity or custom non-Apple code signing certificate" (DMG builds)

For distributing a `.dmg` file *outside* of the Mac App Store directly to users:
- **Root Cause**: Apple uses a different certificate called **"Developer ID Application"** for non-App Store distribution (DMG/ZIP).
- **Solution**:
  1. Ask your client to download a **"Developer ID Application"** certificate from their Apple Developer Account, export it as `.p12`, and add it to the project.
  2. Alternatively, build an **Unsigned DMG** (see Section 5) if they only want it for internal team testing without signing.

---

### "No valid signing identity found"

```bash
# List all signing identities
security find-identity -v -p codesigning

# If empty, reimport the .p12:
security import Final-Certificates.p12 -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign
```

### "Provisioning profile doesn't match"

- Ensure the Bundle ID in the provisioning profile matches `com.graure.appsforfacebookandmessenger`
- Ensure the Team ID matches `L284ZYR49L`
- Re-download the profile from Apple Developer Portal if needed

### "Code signing failed"

```bash
# Check what identities electron-builder sees
export CSC_LINK="$(pwd)/Final-Certificates.p12"
export CSC_KEY_PASSWORD="your-password"
npx electron-builder --mac mas --config.mas.identity="3rd Party Mac Developer Application: YOUR NAME (L284ZYR49L)"
```

### "Product not found" during IAP testing

- Ensure the product IDs in App Store Connect match exactly:
  - `com.graure.appsforfacebookandmessenger.premium_monthly`
  - `com.graure.appsforfacebookandmessenger.premium_yearly`
  - `com.graure.appsforfacebookandmessenger.premium_lifetime`
- Products must be in **"Ready to Submit"** or **"Approved"** status
- Use a **Sandbox Tester** account (Settings → Users and Access → Sandbox)
- On your Mac: Sign out of App Store, sign in with sandbox account

### Build succeeds but .pkg rejected by Transporter

- Check that the app version in `package.json` is higher than the last submitted version
- Ensure the bundle ID hasn't changed
- Run `pkgutil --check-signature release/*.pkg` to verify signing

---

## File Structure Reference

```
messenger-clone/
├── afterSign.js                          # Notarization hook (DMG only)
├── electron-builder.yml                   # Build configuration
├── Electron_App_Store_profile.provisionprofile  # MAS provisioning profile
├── Final-Certificates.p12                 # Signing certificate
├── package.json                           # Scripts & dependencies
├── build/
│   ├── entitlements.mac.plist            # DMG entitlements (hardened runtime)
│   ├── entitlements.mas.plist            # MAS entitlements (sandbox + IAP)
│   └── entitlements.mas.inherit.plist    # MAS child process entitlements
├── .github/workflows/
│   └── build-mac.yml                     # CI/CD pipeline
└── src/
    ├── main/
    │   ├── main.ts                       # Electron main process
    │   ├── iapManager.ts                 # In-app purchase handling
    │   ├── preload.ts                    # Secure context bridge
    │   └── store.ts                      # Encrypted persistent storage
    ├── renderer/
    │   └── components/
    │       ├── Paywall.tsx               # Subscription paywall UI
    │       └── Modals/UpgradeModal.tsx   # Plan management modal
    └── shared/
        ├── constants.ts                  # Bundle ID, IAP product IDs
        └── types.ts                      # TypeScript interfaces
```
