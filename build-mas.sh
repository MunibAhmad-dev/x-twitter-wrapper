#!/bin/bash

KEYCHAIN_PATH=$PWD/build.keychain
KEYCHAIN_PASSWORD="build"

echo "Cleaning up any previous temp keychains..."
security default-keychain -s login.keychain-db
security delete-keychain $KEYCHAIN_PATH 2>/dev/null

echo "Creating new temporary keychain..."
security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
security default-keychain -s $KEYCHAIN_PATH
security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
security set-keychain-settings -t 3600 -u $KEYCHAIN_PATH

echo "Downloading Apple Root and WWDR certificates..."
curl -sL https://www.apple.com/appleca/AppleIncRootCertificate.cer -o AppleRoot.cer
security import AppleRoot.cer -k $KEYCHAIN_PATH -T /usr/bin/codesign

curl -sL https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer -o AppleWWDRCAG3.cer
security import AppleWWDRCAG3.cer -k $KEYCHAIN_PATH -T /usr/bin/codesign

curl -sL https://www.apple.com/certificateauthority/AppleWWDRCAG5.cer -o AppleWWDRCAG5.cer
security import AppleWWDRCAG5.cer -k $KEYCHAIN_PATH -T /usr/bin/codesign

rm AppleRoot.cer AppleWWDRCAG3.cer AppleWWDRCAG5.cer

echo "Importing developer certificates..."
security import "developers-appliction.p12" -k $KEYCHAIN_PATH -P "Mondialu13" -T /usr/bin/codesign
security import "developers-installer.p12" -k $KEYCHAIN_PATH -P "Mondialu13" -T /usr/bin/codesign

echo "Setting key partition list to avoid prompts..."
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH > /dev/null 2>&1

echo "Starting build..."
npm run build:pkg
BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
  echo "Verifying Login Helper entitlements in the newly built package..."
  LOGIN_HELPER_PATH="release/mas-universal/Apps for Facebook & Messenger.app/Contents/Library/LoginItems/Apps for Facebook & Messenger Login Helper.app/Contents/MacOS/Apps for Facebook & Messenger Login Helper"
  if [ -f "$LOGIN_HELPER_PATH" ]; then
    codesign -d --entitlements - "$LOGIN_HELPER_PATH"
  else
    echo "⚠️ Warning: Login Helper binary not found for verification at $LOGIN_HELPER_PATH"
  fi
fi

echo "Cleaning up..."
security default-keychain -s login.keychain-db
security delete-keychain $KEYCHAIN_PATH

if [ $BUILD_STATUS -eq 0 ]; then
  echo "Build completed successfully!"
else
  echo "Build failed with status $BUILD_STATUS"
fi

