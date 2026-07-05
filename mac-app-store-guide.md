# Mac App Store (MAS) Distribution & Subscription Setup Guide

This guide is for you and the Account Holder (your brother) to configure Apple App Store Connect, set up the in-app purchase subscription tiers, and configure GitHub Actions to automatically securely sign and build the application.

## Step 1: Create App Store Connect In-App Purchases

The application relies on three specific product identifiers. These must be created EXACTLY as written below in App Store Connect.

1. Log into [App Store Connect](https://appstoreconnect.apple.com).
2. Go to **My Apps** -> Select your app.
3. In the sidebar, scroll down to **In-App Purchases** -> **Manage**.
4. Click the `+` button to add a new purchase.

You must create three products:

### 1. Monthly Premium
- **Type**: Auto-Renewable Subscription
- **Reference Name**: Premium Monthly
- **Product ID**: `com.appsforfacebook.app.premium_monthly`
- **Subscription Group**: Create a group called "Premium Access"
- **Price**: Tier 3 ($2.99 USD)
- **Free Trial**: In the subscription settings, add an "Introductory Offer" of **Free for 3 Days**.

### 2. Yearly Premium
- **Type**: Auto-Renewable Subscription
- **Reference Name**: Premium Yearly
- **Product ID**: `com.appsforfacebook.app.premium_yearly`
- **Subscription Group**: "Premium Access"
- **Price**: Tier 7 ($6.99 USD)
- **Free Trial**: In the subscription settings, add an "Introductory Offer" of **Free for 3 Days**.

### 3. Lifetime Premium
- **Type**: Non-Consumable
- **Reference Name**: Premium Lifetime
- **Product ID**: `com.appsforfacebook.app.premium_lifetime`
- **Price**: Tier 15 ($14.99 USD)

*Ensure you submit localized descriptions and a review screenshot for all three items so Apple approves them.*

---

## Step 2: Export Certificates (Account Holder task)

Since your brother is the Account Holder, he needs to generate the signing certificates on his Mac.

1. Open Xcode on his Mac.
2. Go to **Xcode > Settings > Accounts**.
3. Sign in with his Apple ID.
4. Select his Team and click **Manage Certificates**.
5. Click the `+` at the bottom left and create two certificates:
   - **Apple Distribution** (or "Mac App Distribution")
   - **Mac Installer Distribution**
6. Open the **Keychain Access** app on his Mac.
7. Find both certificates you just created (under the "My Certificates" tab).
8. Shift-click to select **both** certificates.
9. Right-click and choose **Export 2 Items...**
10. Save the file as `Certificates.p12`.
11. It will ask for a password. Set a strong password (e.g., `MySecurePassword123`) and remember it!

---

## Step 3: Base64 Encode the Certificate

GitHub Actions cannot securely read binary `.p12` files directly. You must convert it to a Base64 string.

On a Mac terminal, run:
```bash
base64 -i Certificates.p12 -o cert_base64.txt
```
Copy the entire contents of `cert_base64.txt`.

---

## Step 4: Configure GitHub Secrets

Now, you must securely inject the signing configuration into your GitHub repository.

1. Go to your GitHub Repository.
2. Go to **Settings > Secrets and variables > Actions**.
3. Add the following **New repository secrets**:

| Secret Name | Value |
| --- | --- |
| `CSC_LINK` | The Base64 string from Step 3 (paste the entire text). |
| `CSC_KEY_PASSWORD` | The password your brother set in Step 2 (e.g., `MySecurePassword123`). |
| `APPLE_ID` | Your brother's Apple ID email address (e.g., `john@apple.com`). |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password generated from [appleid.apple.com](https://appleid.apple.com) (used for notarization). |
| `APPLE_TEAM_ID` | His 10-character Apple Developer Team ID (found in the top right of the Apple Developer portal). |

---

## Step 5: Build and Deploy!

Once the secrets are in place, the automated pipeline takes over.

1. Commit and push any code change to the `main` branch.
2. Go to the **Actions** tab in GitHub.
3. Watch the "Build macOS DMG" workflow run.
4. Because the secrets are present, `electron-builder` will automatically detect the `.p12` certificate, sign the application, and package it into a Mac App Store ready `.pkg` file and a direct distribution `.dmg` file.
5. Download the `.pkg` artifact from GitHub Actions.
6. Open the **Transporter** app (available free on the Mac App Store), log in, and upload the `.pkg` file to App Store Connect.

Your application is now locked with the subscription paywall and ready for TestFlight or Production distribution!
