// Loads the compiled native addon. Kept in a try/catch so a missing/unbuilt
// binary degrades gracefully to the App Store deep-link fallback in the caller
// instead of crashing the main process.
'use strict';

let binding = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  binding = require('./build/Release/store_review.node');
} catch (err) {
  binding = null;
}

module.exports = {
  /**
   * Presents the native in-app rating overlay via SKStoreReviewController.
   * @returns {boolean} true if the StoreKit API was invoked (MAS builds show
   *   the overlay; dev/DMG builds invoke it as a silent no-op). false if the
   *   native binary is missing or the API is unavailable.
   */
  requestReview() {
    if (binding && typeof binding.requestReview === 'function') {
      try {
        return binding.requestReview();
      } catch (err) {
        return false;
      }
    }
    return false;
  },
  isAvailable() {
    return binding != null && typeof binding.requestReview === 'function';
  },
};
