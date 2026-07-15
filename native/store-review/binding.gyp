{
  "targets": [
    {
      "target_name": "store_review",
      "sources": [ "src/store_review.mm" ],
      "conditions": [
        [ "OS=='mac'", {
          "xcode_settings": {
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "MACOSX_DEPLOYMENT_TARGET": "11.0",
            "OTHER_CFLAGS": [ "-ObjC++" ]
          },
          "link_settings": {
            "libraries": [
              "$(SDKROOT)/System/Library/Frameworks/StoreKit.framework",
              "$(SDKROOT)/System/Library/Frameworks/Foundation.framework"
            ]
          }
        } ]
      ]
    }
  ]
}
