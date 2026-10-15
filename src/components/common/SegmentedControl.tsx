import React, { useEffect, useRef, useState } from "react";
import { Animated, I18nManager, StyleSheet, Text, View } from "react-native";
import { Press } from "./Press";
import { styles } from "../../styles";
import { colors, radii } from "../../design/tokens";
import { durations } from "../../design/motion";
import { haptic } from "../../design/haptics";
import { physicalEdge } from "../../i18n";

type SegmentedOption<T extends string> = {
  key: T;
  label: string;
  /** Small terracotta dot after the label — "this segment holds something that is
   *  ON". For tab-like controls whose panes hide state (the player's practice
   *  drawers); plain selectors leave it unset. */
  dot?: boolean;
  /** A glyph set above the word (the metronome's note values). Every option in a
   *  control should carry one or none, so the segments stay the same height. */
  glyph?: string;
};

/**
 * Persistent thumb state for a SegmentedControl that gets unmounted and
 * remounted while staying logically "the same" control — e.g. one embedded in a
 * screen whose tabs swap the whole subtree on selection. Own this in a parent
 * that does NOT remount and pass it as `persist`: the remounted control then
 * keeps its measured width and last position, so the thumb slides from the
 * previous segment instead of snapping in from the far left on every switch.
 */
export type SegmentedThumb = {
  thumbX: Animated.Value;
  trackWidth: number;
  setTrackWidth: (width: number) => void;
  positioned: React.MutableRefObject<boolean>;
};

export function useSegmentedThumb(): SegmentedThumb {
  const thumbX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const positioned = useRef(false);
  return { thumbX, trackWidth, setTrackWidth, positioned };
}

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  selectedKey?: T;
  onSelect?: (key: T) => void;
  /** Persistent thumb (see useSegmentedThumb) for controls that remount. */
  persist?: SegmentedThumb;
};

/**
 * Tabs in ink (2026-10-15, founder picked "Ink"): the words sit on a hairline,
 * the chosen one in full ink with a 2 pt rule beneath it that slides along the
 * hairline to the next choice; the others recede. No track, no white thumb, no
 * shadow: the same "a line under the one you are editing" the loop's edge
 * readouts use.
 */
const TRACK_PAD_H = 0;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  selectedKey,
  onSelect,
  persist,
}: Props<T>) {
  const activeKey = selectedKey ?? value;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === activeKey)
  );

  // Self-owned thumb state, used unless the caller supplies a persistent one.
  const [ownTrackWidth, setOwnTrackWidth] = useState(0);
  const ownThumbX = useRef(new Animated.Value(0)).current;
  const ownPositioned = useRef(false);

  const thumbX = persist?.thumbX ?? ownThumbX;
  const trackWidth = persist ? persist.trackWidth : ownTrackWidth;
  const setTrackWidth = persist ? persist.setTrackWidth : setOwnTrackWidth;
  const positioned = persist?.positioned ?? ownPositioned;

  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PAD_H * 2) / options.length : 0;

  // Slide the thumb under the active segment. The first time we know the track
  // width, snap into place (no slide-from-left); after that, animate — which
  // includes the case where `persist` carries the previous position across a
  // remount, so a swapped-subtree screen still slides in the tapped direction.
  //
  // The thumb's anchor edge resolves to the physical RIGHT under RTL, and
  // translateX is always physical (positive = rightwards). So the offset is
  // counted from whichever edge segment 0 sits against — rightwards in English,
  // leftwards in Hebrew — which is just the index with a flipped sign. Counting
  // physical positions from the left instead slid the thumb one segment past the
  // end of the track, where the screen clipped it.
  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = (I18nManager.isRTL ? -1 : 1) * activeIndex * segmentWidth;
    if (!positioned.current) {
      positioned.current = true;
      thumbX.setValue(target);
      return;
    }
    Animated.timing(thumbX, {
      toValue: target,
      duration: durations.base,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, options.length, segmentWidth, thumbX, positioned]);

  function handleSelect(key: T) {
    if (key === activeKey) return;
    haptic.tap();
    onSelect?.(key);
    onChange?.(key);
  }

  return (
    <View
      style={segmentedControlStyles.root}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            segmentedControlStyles.thumb,
            { width: segmentWidth, transform: [{ translateX: thumbX }] },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.key === activeKey;
        return (
          <Press
            haptic="none"
            key={option.key}
            style={segmentedControlStyles.segment}
            onPress={() => handleSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <View style={[segmentedControlStyles.segmentInner, option.glyph ? segmentedControlStyles.segmentInnerStacked : null]}>
              {option.glyph ? (
                <Text
                  style={[
                    segmentedControlStyles.segmentGlyph,
                    active ? segmentedControlStyles.segmentGlyphActive : null,
                  ]}
                >
                  {option.glyph}
                </Text>
              ) : null}
              <Text
                style={[
                  segmentedControlStyles.segmentLabel,
                  option.glyph ? segmentedControlStyles.segmentLabelSmall : null,
                  active ? segmentedControlStyles.segmentLabelActive : null,
                ]}
              >
                {option.label}
              </Text>
              {option.dot ? <View style={segmentedControlStyles.segmentDot} /> : null}
            </View>
          </Press>
        );
      })}
    </View>
  );
}

const segmentedControlStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    paddingHorizontal: TRACK_PAD_H,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  // The chosen tab's rule: 2 pt of ink, sitting on the hairline.
  thumb: {
    position: "absolute",
    bottom: -1,
    height: 2,
    [physicalEdge("left")]: TRACK_PAD_H,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
  },
  segment: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  segmentInnerStacked: {
    flexDirection: "column",
    gap: 1,
  },
  // Note values: the serif face carries the music symbols (the system falls
  // back per glyph where a face lacks one), a size up so they read as notes.
  segmentGlyph: {
    fontFamily: "Lora_500Medium",
    fontSize: 18,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  segmentGlyphActive: {
    color: colors.textPrimary,
  },
  segmentLabelSmall: {
    fontSize: 11.5,
  },
  segmentDot: {
    width: 5,
    height: 5,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 15,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textPrimary,
  },
});
