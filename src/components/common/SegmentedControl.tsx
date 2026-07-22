import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../../styles";
import { colors, radii, shadows } from "../../design/tokens";
import { durations } from "../../design/motion";
import { haptic } from "../../design/haptics";

type SegmentedOption<T extends string> = {
  key: T;
  label: string;
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

const TRACK_PAD_H = 4;

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
  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
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
  }, [activeIndex, segmentWidth, thumbX, positioned]);

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
          <Pressable
            key={option.key}
            style={({ pressed }) => [
              segmentedControlStyles.segment,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => handleSelect(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                segmentedControlStyles.segmentLabel,
                active ? segmentedControlStyles.segmentLabelActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const segmentedControlStyles = StyleSheet.create({
  root: {
    flexDirection: "row",
    paddingHorizontal: TRACK_PAD_H,
    paddingVertical: 3,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
  },
  thumb: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: TRACK_PAD_H,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    ...shadows.control,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },
});
