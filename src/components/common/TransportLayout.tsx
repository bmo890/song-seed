import React, { ReactNode, forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { styles } from "../../styles";
import { durations } from "../../design/motion";

type Props = {
  header?: ReactNode;
  /** Fixed region between the header and the scrollable body (e.g. a pinned waveform). */
  stickyTop?: ReactNode;
  floating?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  /** When the footer's first row draws its own top line (the full-view progress
   *  thread doubles as the divider), the zone's hairline must stand down. */
  footerDivider?: boolean;
};

export type TransportLayoutHandle = {
  /**
   * Scroll the body just enough to bring `node` (a mounted View inside the
   * scrollable body) fully into view — nothing moves when it already is. A
   * block taller than the viewport shows its top. No-op when not scrollable.
   */
  reveal: (node: View) => void;
};

/** Breathing room kept between a revealed row and the viewport's edges. */
const REVEAL_PADDING = 12;

export const TransportLayout = forwardRef<TransportLayoutHandle, Props>(function TransportLayout(
  { header, stickyTop, floating, footer, children, scrollable = false, footerDivider = true },
  ref
) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Read on the UI thread — no JS scroll listener, so a user's scroll never
  // costs a render in a screen that is sensitive to them (the player).
  const scrollOffset = useScrollViewOffset(scrollRef);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  // The programmatic glide: a single shared value the scroll follows while it
  // animates; `null` means "hands off", so user scrolling is never fought.
  const revealY = useSharedValue<number | null>(null);

  useAnimatedReaction(
    () => revealY.value,
    (y) => {
      if (y != null) scrollTo(scrollRef, 0, y, false);
    }
  );

  const reveal = useCallback(
    (node: View) => {
      const scroll = scrollRef.current;
      // Fabric measures against a host instance, not a node handle — the content
      // container ref, so `contentY` is in scroll-content space on both platforms.
      // (`getInnerViewRef` is a real ScrollView method the TS typings omit.)
      const inner = (scroll as unknown as { getInnerViewRef?: () => View | null } | null)
        ?.getInnerViewRef?.();
      if (!scroll || !inner) return;
      node.measureLayout(inner, (_x, contentY, _width, height) => {
        const offset = scrollOffset.value;
        const viewportHeight = viewportHeightRef.current;
        if (viewportHeight <= 0) return;
        const top = contentY - REVEAL_PADDING;
        const bottom = contentY + height + REVEAL_PADDING;
        let target: number | null = null;
        if (top < offset) target = top;
        else if (bottom > offset + viewportHeight) target = Math.min(bottom - viewportHeight, top);
        if (target == null) return;
        const maxOffset = Math.max(0, contentHeightRef.current - viewportHeight);
        target = Math.max(0, Math.min(maxOffset, target));
        revealY.value = offset;
        revealY.value = withTiming(
          target,
          { duration: durations.slow, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) revealY.value = null;
          }
        );
      });
    },
    [revealY, scrollOffset, scrollRef]
  );

  useImperativeHandle(ref, () => ({ reveal }), [reveal]);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);
  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeightRef.current = height;
  }, []);

  const surfaceStyle = [styles.transportSurface, floating ? styles.transportSurfaceWithFloating : null];
  const content = scrollable ? (
    <Animated.ScrollView
      ref={scrollRef}
      style={surfaceStyle}
      contentContainerStyle={[
        styles.transportScrollContent,
        floating ? styles.transportScrollContentWithFloating : null,
      ]}
      showsVerticalScrollIndicator={false}
      // A short page must not rubber-band: the bounce is a scroll, and a scroll
      // cancels the sheet's drag-down on the empty paper below the content.
      alwaysBounceVertical={false}
      onLayout={handleViewportLayout}
      onContentSizeChange={handleContentSizeChange}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <View style={surfaceStyle}>{children}</View>
  );

  return (
    <View style={styles.transportLayout}>
      {header ? <View style={styles.transportHeaderZone}>{header}</View> : null}
      {stickyTop ?? null}
      <View style={styles.transportBodyZone}>
        {content}
        {floating ? <View style={styles.transportFloatingZone}>{floating}</View> : null}
      </View>
      {footer ? (
        <View
          style={[
            styles.transportFooterZone,
            footerDivider ? null : styles.transportFooterZoneNoDivider,
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
});
