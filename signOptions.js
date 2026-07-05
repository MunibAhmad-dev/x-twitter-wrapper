module.exports = function (filePath) {
  // Do not sign non-executable files with entitlements to avoid errSecInternalComponent on macOS 13+
  if (
    filePath.endsWith('.pak') ||
    filePath.endsWith('.dat') ||
    filePath.endsWith('.bin') ||
    filePath.endsWith('.json') ||
    filePath.endsWith('.png') ||
    filePath.endsWith('.icns')
  ) {
    return {
      entitlements: null,
      entitlementsInherit: null,
      hardenedRuntime: false,
      signatureFlags: 'library' // Just sign as library without strict entitlements
    };
  }
  return null;
};
