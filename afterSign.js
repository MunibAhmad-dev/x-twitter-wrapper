/**
 * afterSign.js — Notarization hook for electron-builder (DMG builds only).
 *
 * This script runs automatically after code signing for DMG/ZIP builds.
 * Mac App Store (MAS) builds do NOT need notarization — Apple reviews them.
 *
 * Required environment variables:
 *   APPLE_ID                    — Your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — App-specific password from appleid.apple.com
 *   APPLE_TEAM_ID               — Your Apple Developer Team ID
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS DMG/ZIP builds (not MAS — Apple handles that)
  if (electronPlatformName !== 'darwin') {
    console.log('[Notarize] Skipping — not a macOS build.');
    return;
  }

  // Skip if we are building an unsigned package
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    console.log('[Notarize] Skipping — CSC_IDENTITY_AUTO_DISCOVERY is set to false (unsigned build).');
    return;
  }

  // Skip if this is a MAS build
  if (context.targets && context.targets.some(t => t.name === 'mas')) {
    console.log('[Notarize] Skipping — MAS builds are reviewed by Apple, not notarized.');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('[Notarize] Missing APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID. Skipping notarization.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[Notarize] Notarizing ${appPath}...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
    console.log('[Notarize] ✅ Notarization complete!');
  } catch (error) {
    console.error('[Notarize] ❌ Notarization failed:', error);
    throw error;
  }
};
