import React, {
  ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../../design/tokens";
import Animated, {
  Easing,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export type TransportScroll = {
  /** The body's scroll offset, read on the UI thread. */
  scrollOffset: SharedValue<number>;
  /** `node`'s top in scroll-content coordinates, measured natively. */
  measureContentTop: (node: View, onMeasured: (contentY: number) => void) => void;
};

const TransportScrollContext = createContext<TransportScroll | null>(null);

/** The enclosing TransportLayout's scroll, for blocks inside the body that
 *  follow it (StickyInScroll). `null` outside a scrollable layout. */
export function useTransportScroll(): TransportScroll | null {
  return useContext(TransportScrollContext);
}
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
  /** The height between header and footer (the sticky band plus the body), as laid
   *  out. Constant while the sticky band resizes, so the player sizes its reel from it
   *  instead of guessing the chrome around it. */
  onBodyHeight?: (height: number) => void;
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
  { header, stickyTop, floating, footer, children, scrollable = false, footerDivider = true, onBodyHeight },
  ref
) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const zoneHeights = useRef({ sticky: 0, body: 0 });
  const reportZone = (zone: "sticky" | "body", height: number) => {
    zoneHeights.current[zone] = height;
    if (!stickyTop) zoneHeights.current.sticky = 0;
    onBodyHeight?.(Math.round(zoneHeights.current.sticky + zoneHeights.current.body));
  };
  // Read on the UI thread — no JS scroll listener, so a user's scroll never
  // costs a render in a screen that is sensitive to them (the player).
  const scrollOffset = useScrollViewOffset(scrollRef);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  // The programmatic glide: a single shared value the scroll follows while it
  // animates; `null` means "hands off", so user scrolling is never fought.
  const revealY = useSharedValue<number | null>(null);
  // The bottom edge fades while more of the page is below it, so a row cut by
  // the footer reads as "scroll for more", not as broken (2026-10-18).
  const viewportHeightSV = useSharedValue(0);
  const contentHeightSV = useSharedValue(0);

  useAnimatedReaction(
    () => revealY.value,
    (y) => {
      if (y != null) scrollTo(scrollRef, 0, y, false);
    }
  );

  const measureContentTop = useCallback(
    (node: View, onMeasured: (contentY: number) => void) => {
      const scroll = scrollRef.current;
      // Fabric measures against a host instance, not a node handle — the content
      // container ref, so `contentY` is in scroll-content space on both platforms.
      // (`getInnerViewRef` is a real ScrollView method the TS typings omit.)
      const inner = (scroll as unknown as { getInnerViewRef?: () => View | null } | null)
        ?.getInnerViewRef?.();
      if (!scroll || !inner) return;
      node.measureLayout(inner, (_x, contentY) => onMeasured(contentY));
    },
    [scrollRef]
  );

  const reveal = useCallback(
    (node: View) => {
      const scroll = scrollRef.current;
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

  const transportScroll = useMemo<TransportScroll>(
    () => ({ scrollOffset, measureContentTop }),
    [measureContentTop, scrollOffset]
  );

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
    viewportHeightSV.value = event.nativeEvent.layout.height;
  }, []);
  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeightRef.current = height;
    contentHeightSV.value = height;
  }, []);

  const edgeFadeStyle = useAnimatedStyle(() => {
    const remaining = contentHeightSV.value - viewportHeightSV.value - scrollOffset.value;
    return { opacity: Math.max(0, Math.min(1, remaining / EDGE_FADE_HEIGHT)) };
  });

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
      <TransportScrollContext.Provider value={transportScroll}>{children}</TransportScrollContext.Provider>
    </Animated.ScrollView>
  ) : (
    <View style={surfaceStyle}>{children}</View>
  );

  return (
    <View style={styles.transportLayout}>
      {header ? <View style={styles.transportHeaderZone}>{header}</View> : null}
      {stickyTop ? (
        <View onLayout={onBodyHeight ? (event) => reportZone("sticky", event.nativeEvent.layout.height) : undefined}>
          {stickyTop}
        </View>
      ) : null}
      <View
        style={styles.transportBodyZone}
        onLayout={onBodyHeight ? (event) => reportZone("body", event.nativeEvent.layout.height) : undefined}
      >
        {content}
        {scrollable ? (
          <Animated.View pointerEvents="none" style={[edgeFade.wrap, edgeFadeStyle]}>
            <Svg width="100%" height={EDGE_FADE_HEIGHT}>
              <Defs>
                <LinearGradient id="transportEdgeFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.page} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.page} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height={EDGE_FADE_HEIGHT} fill="url(#transportEdgeFade)" />
            </Svg>
          </Animated.View>
        ) : null}
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

const EDGE_FADE_HEIGHT = 28;

const edgeFade = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: EDGE_FADE_HEIGHT,
  },
});
