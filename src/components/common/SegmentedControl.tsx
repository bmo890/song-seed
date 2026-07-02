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

type Props<T extends string> = {
  options: SegmentedOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  selectedKey?: T;
  onSelect?: (key: T) => void;
};

const TRACK_PAD_H = 4;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  selectedKey,
  onSelect,
}: Props<T>) {
  const activeKey = selectedKey ?? value;
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.key === activeKey)
  );

  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PAD_H * 2) / options.length : 0;
  const thumbX = useRef(new Animated.Value(activeIndex * segmentWidth)).current;

  // Slide the thumb under the active segment instead of swapping backgrounds.
  useEffect(() => {
    if (segmentWidth <= 0) return;
    Animated.timing(thumbX, {
      toValue: activeIndex * segmentWidth,
      duration: durations.base,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, thumbX]);

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
