import React, { type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { collapseIn, collapseOut } from "../../design/motion";

/**
 * Accordion body that settles in instead of popping: fade + a slight vertical
 * slide on expand, quick fade on collapse (the design language allows fades and
 * subtle vertical motion only). Used by the overdub layer sections and the
 * practice panel's tool disclosure — one wrapper so every accordion in the app
 * moves identically.
 */
export function AnimatedCollapse({
  visible,
  children,
  style,
}: {
  visible: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (!visible) return null;
  return (
    <Animated.View entering={collapseIn} exiting={collapseOut} style={style}>
      {children}
    </Animated.View>
  );
}
