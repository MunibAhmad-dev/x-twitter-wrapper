// Native N-API addon: bridges Electron's main process to StoreKit's
// SKStoreReviewController so we can present the in-app rating overlay
// (tap a star -> submitted, no App Store window).
//
// Deliberately uses the raw C N-API + Objective-C runtime lookups instead of
// ffi-napi / node-addon-api: ffi-napi does not compile on Node 20+ / recent
// macOS SDKs (napi_add_finalizer signature change), which is why the previous
// `objc` bridge never worked.
//
// StoreKit decides whether to present the overlay in production and applies
// its own frequency limits. Apple documents that development-mode calls show
// the rating view for UI testing.

#import <Foundation/Foundation.h>
#include <node_api.h>

// Invokes +[SKStoreReviewController requestReview] on the main thread.
// Returns a JS boolean: true if the StoreKit API exists and was invoked.
static napi_value RequestReview(napi_env env, napi_callback_info info) {
  bool invoked = false;

  // Resolve the class at runtime so the addon still loads on any macOS even if
  // StoreKit were unavailable, and so we don't hard-require the newer selector.
  Class controller = NSClassFromString(@"SKStoreReviewController");
  if (controller != nil) {
    SEL selector = NSSelectorFromString(@"requestReview");
    if ([controller respondsToSelector:selector]) {
      dispatch_block_t present = ^{
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
        [controller performSelector:selector];
#pragma clang diagnostic pop
      };

      // StoreKit UI must be driven from the main thread. Electron's main
      // process JS already runs there, but guard anyway.
      if ([NSThread isMainThread]) {
        present();
      } else {
        dispatch_async(dispatch_get_main_queue(), present);
      }
      invoked = true;
    }
  }

  napi_value result;
  napi_get_boolean(env, invoked, &result);
  return result;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "requestReview", NAPI_AUTO_LENGTH, RequestReview,
                       nullptr, &fn);
  napi_set_named_property(env, exports, "requestReview", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
