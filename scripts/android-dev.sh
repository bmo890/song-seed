#!/bin/sh
# Build, install, launch, and serve the Android dev build in one reliable shot.
#
# Why this replaces a plain `expo run:android`:
#   1. The dev variant's applicationId (com.bmostudio.songnook.dev) deliberately differs from
#      its namespace (com.bmostudio.songnook) so the dev and production builds can both live on
#      one device — see plugins/withSongNookAndroidVariants.js. Expo's launch step assumes the
#      two match and always fails with "Activity class ... does not exist".
#   2. After an `adb uninstall`, Gradle/Expo sometimes consider the build up-to-date and skip
#      actually pushing the APK, leaving the device with "No development build is installed" —
#      so the run only succeeds on a second attempt.
#
# This script builds with Gradle, force-installs the APK itself (with a clean-install fallback),
# launches the real activity, then serves Metro — making `uninstall -> build` reproducible.
#
# Single device is assumed. With several attached, select one with: ANDROID_SERIAL=<serial> npm run android
set -e

APP_ID="com.bmostudio.songnook.dev"
ACTIVITY="com.bmostudio.songnook.MainActivity"
APK="android/app/build/outputs/apk/development/debug/app-development-debug.apk"

echo "==> Building developmentDebug APK..."
( cd android && ./gradlew assembleDevelopmentDebug )

echo "==> Installing $APK ..."
if ! adb install -r -d "$APK"; then
  echo "    Reinstall failed — removing any existing/ghost install and retrying clean..."
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb install "$APK"
fi

echo "==> Starting Metro..."
npx expo start --dev-client --scheme songnook-dev &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null' INT TERM EXIT

# Wait for Metro to actually serve before launching, so the dev client connects on the first
# try instead of showing a "could not connect" retry screen.
i=0
while [ "$i" -lt 30 ]; do
  if curl -sf http://localhost:8081/status >/dev/null 2>&1; then break; fi
  sleep 1
  i=$((i + 1))
done

echo "==> Forwarding Metro port over USB and launching $APP_ID ..."
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
adb shell am start -n "$APP_ID/$ACTIVITY"

# Hand the foreground back to Metro so logs stream and Ctrl-C stops it cleanly.
wait "$METRO_PID"
