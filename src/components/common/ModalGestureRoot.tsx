import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/**
 * Every native Modal's content sits under its own gesture root. On Android a Modal is a
 * separate window, and gesture-handler stops looking for its root at that window's edge:
 * without this, every Slider, Stepper, scrub and drag inside a sheet was dead there
 * (overnight check 2026-10-20). Harmless on iOS.
 */
export function ModalGestureRoot({ children }: { children: ReactNode }) {
  return <GestureHandlerRootView style={styles.fill}>{children}</GestureHandlerRootView>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
