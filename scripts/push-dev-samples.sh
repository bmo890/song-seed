#!/usr/bin/env bash
# Push audio files into the iOS Simulator app's Documents/dev-samples/ so the
# __DEV__ "Import samples (dev)" action (create-FAB menu) can import real clips
# without the system document picker. Used by the .maestro/clip-flows/ tests.
#
# Usage: scripts/push-dev-samples.sh [UDID] [SOURCE_DIR] [COUNT]
set -euo pipefail
UDID="${1:-booted}"
SRC="${2:-/Users/benmogerman/Desktop/Voice Recorder (old)}"
COUNT="${3:-6}"
BUNDLE="com.bmostudio.songnook.dev"

DATA="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data)"
DEST="$DATA/Documents/dev-samples"
mkdir -p "$DEST"
rm -f "$DEST"/*.m4a 2>/dev/null || true

i=1
for f in "$SRC"/*.m4a; do
  [ "$i" -gt "$COUNT" ] && break
  cp "$f" "$DEST/$(printf 'sample-%02d.m4a' "$i")"
  i=$((i+1))
done
echo "Pushed $((i-1)) sample(s) to $DEST"
