import React, { useCallback, useRef, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useTransportScroll } from "./TransportLayout";

type StickyInScrollProps = {
  children: ReactNode;
  /** The row's own fill — later siblings slide beneath it, so it must be opaque. */
  style?: StyleProp<ViewStyle>;
};

/**
 * A block inside a TransportLayout body that stays put once the scroll
 * reaches it: it scrolls up with its neighbours, then pins to the top of the
 * body while what follows passes beneath. ScrollView's own sticky headers
 * only reach direct children; this works anywhere in the tree. The pin is a
 * UI-thread translate off the scroll offset — no render per frame. Outside a
 * scrollable layout it is a plain View.
 */
export function StickyInScroll({ children, style }: StickyInScrollProps) {
  const transport = useTransportScroll();
  const nodeRef = useRef<View>(null);
  const contentTop = useSharedValue(Number.POSITIVE_INFINITY);

  const measure = useCallback(() => {
    const node = nodeRef.current;
    if (!node || !transport) return;
    transport.measureContentTop(node, (y) => {
      contentTop.value = y;
    });
  }, [contentTop, transport]);

  const pinned = useAnimatedStyle(() => {
    if (!transport) return { transform: [{ translateY: 0 }] };
    const offset = transport.scrollOffset.value;
    return { transform: [{ translateY: Math.max(0, offset - contentTop.value) }] };
  });

  return (
    <Animated.View ref={nodeRef} onLayout={measure} style={[local.pinned, style, pinned]}>
      {children}
    </Animated.View>
  );
}

const local = StyleSheet.create({
  pinned: {
    zIndex: 2,
  },
});
