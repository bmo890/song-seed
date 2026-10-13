#!/bin/sh
# Craft guardrails (docs/product-plan/craft-control-kit.md, move 3).
#
# Each rule counts the places the control kit is bypassed. The baseline file
# records the count the migration still has to clear. The script FAILS when a
# count rises (new drift) and REPORTS when one falls (lower the baseline).
#
#   sh scripts/craft-lint.sh                 check against the baseline
#   sh scripts/craft-lint.sh --write-baseline  record the current counts
#
# Counts are of matching LINES in src/, excluding __tests__.

set -u
cd "$(dirname "$0")/.." || exit 1
BASELINE="scripts/craft-lint.baseline"
SRC="src"
WRITE=0
[ "${1:-}" = "--write-baseline" ] && WRITE=1

src_files() {
  find "$SRC" \( -name '*.ts' -o -name '*.tsx' \) -not -path '*/__tests__/*' -not -path '*/dev/*'
}

# rule <key> <pipeline producing matching lines>
count() {
  n=$(eval "$2" | wc -l | tr -d ' ')
  echo "$1=$n"
}

rules() {
  # Haptics only via haptics.ts (the metronome engine is the one exception).
  count haptics_direct \
    "src_files | grep -v 'design/haptics.ts' | grep -v 'hooks/useMetronome.ts' | xargs grep -n 'from \"expo-haptics\"'"
  # Stock widgets.
  count slider_stock \
    "src_files | xargs grep -n 'react-native-community/slider'"
  count switch_stock \
    "src_files | xargs grep -nE 'import \{[^}]*\bSwitch\b[^}]*\} from \"react-native\"'"
  count spinner_stock \
    "src_files | xargs grep -n '<ActivityIndicator'"
  count alert_native \
    "src_files | grep -v 'common/AppAlert.ts' | grep -v 'common/AppDialog.tsx' | xargs grep -n 'Alert\.alert('"
  # One press language: raw Pressables outside the kit and the gesture hosts.
  count pressable_raw \
    "src_files | grep -vE 'common/(Press|IconButton|AudioReel|TimeRangeSelector|ListScrubber|WaveformStrip|ScrubBar)\.tsx' | xargs grep -nE '<(Pressable|TouchableOpacity)\b'"
  count press_adhoc \
    "src_files | xargs grep -nE 'pressed \? 0\.[0-9]|pressDownStrong|styles\.pressDown|appStyles\.pressDown'"
  # Motion only via motion.ts.
  count motion_duration \
    "src_files | grep -v 'design/motion.ts' | xargs grep -nE 'duration: ?[0-9]{2,4}\b' | grep -v durationMs"
  count motion_spring \
    "src_files | grep -v 'design/motion.ts' | xargs grep -nE '(damping|stiffness): ?[0-9]'"
  # Type.
  count font_weight_bare \
    "for f in \$(src_files | xargs grep -l fontWeight); do grep -q fontFamily \"\$f\" || echo \"\$f\"; done"
  # Colour only from tokens (the legacy palette in src/styles is the slow lane).
  count color_literal \
    "src_files | grep -vE 'design/tokens.ts|domain/workspaceTheme.ts|i18n/' | xargs grep -nE '\"#[0-9a-fA-F]{3,8}\"|rgba\('"
}

current=$(rules)

if [ "$WRITE" = "1" ]; then
  echo "$current" > "$BASELINE"
  echo "baseline written:"
  cat "$BASELINE"
  exit 0
fi

if [ ! -f "$BASELINE" ]; then
  echo "no baseline at $BASELINE; run with --write-baseline" >&2
  exit 2
fi

fail=0
echo "$current" | while IFS='=' read -r key now; do
  was=$(grep "^$key=" "$BASELINE" | cut -d= -f2)
  if [ -z "$was" ]; then
    echo "NEW RULE  $key: $now (not in baseline; write it)"
    exit 3
  elif [ "$now" -gt "$was" ]; then
    echo "DRIFT     $key: $now (baseline $was)"
    exit 1
  elif [ "$now" -lt "$was" ]; then
    echo "lower     $key: $now (baseline $was) — tighten the baseline"
  else
    echo "ok        $key: $now"
  fi
done
status=$?
[ "$status" = "1" ] && { echo "craft-lint: new drift. See docs/product-plan/craft-control-kit.md" >&2; exit 1; }
[ "$status" = "3" ] && exit 3
exit 0
