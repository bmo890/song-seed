import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { haptic } from "../../design/haptics";

export type BottomSheetRef = { close: () => void };

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  dismissDistance?: number;
  keyboardAvoiding?: boolean;
  /** Opt in to drag-to-expand: the sheet rests at a collapsed height, pulls up
   * to near-fullscreen, and dismisses on a downward drag past the collapsed
   * stop. Expand/collapse RESIZES the sheet (content fits and scrolls inside at
   * every height); only entrance and dismissal slide. */
  expandable?: boolean;
  /** Total sheet height at the collapsed rest stop (expandable only). */
  collapsedHeight?: number;
  children: ReactNode;
};

const HANDLE_ZONE = 30; // drag zone height (padding 10+10 + handle)

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet(
    { visible, onClose, dismissDistance = 320, keyboardAvoiding = false, expandable = false, collapsedHeight, children },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const translateY = useRef(new Animated.Value(0)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const isClosingRef = useRef(false);

    // translateY must be consistently JS-driven in expandable mode (it shares a
    // node with the JS-driven body height); native elsewhere for smoothness.
    const useNative = !expandable;

    // ── Expandable resize geometry ──────────────────────────────────────────
    // The children area height animates between collapsed and expanded; the card
    // (handle + body + bottom padding) sizes to it, bottom-anchored. Chrome =
    // the fixed handle zone + bottom padding around the resizable body.
    const chrome = HANDLE_ZONE + 14 + insets.bottom;
    const expandedTotal = Math.round(windowHeight - insets.top - 8);
    const collapsedTotal = Math.min(collapsedHeight ?? 560, Math.round(windowHeight * 0.72));
    const collapsedBody = Math.max(120, collapsedTotal - chrome);
    const expandedBody = Math.max(collapsedBody, expandedTotal - chrome);

    const bodyHeight = useRef(new Animated.Value(collapsedBody)).current;
    const restBodyRef = useRef(collapsedBody);

    useEffect(() => {
      if (!visible) return;
      isClosingRef.current = false;
      if (expandable) {
        bodyHeight.setValue(collapsedBody);
        restBodyRef.current = collapsedBody;
      }
      translateY.setValue(32);
      keyboardOffset.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: useNative,
      }).start();
      // Only re-run on visibility flips; geometry is stable per open session.
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keyboard-driven offset: listen to show/hide events and animate
    useEffect(() => {
      if (!keyboardAvoiding || !visible) return;

      const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

      const showSub = Keyboard.addListener(showEvent, (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: Platform.OS === "ios" ? (e.duration ?? 250) : 250,
          useNativeDriver: useNative,
        }).start();
      });
      const hideSub = Keyboard.addListener(hideEvent, (e) => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === "ios" ? (e.duration ?? 250) : 250,
          useNativeDriver: useNative,
        }).start();
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [keyboardAvoiding, visible, keyboardOffset, insets.bottom, useNative]);

    const closeWithSlide = useCallback(() => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      Keyboard.dismiss();
      Animated.timing(translateY, {
        toValue: Math.max(dismissDistance, 700),
        duration: 220,
        useNativeDriver: useNative,
      }).start(({ finished }) => {
        if (!finished) {
          isClosingRef.current = false;
          return;
        }
        onClose();
      });
    }, [dismissDistance, onClose, translateY, useNative]);

    const snapBody = useCallback(
      (target: number) => {
        if (target !== restBodyRef.current) haptic.light();
        restBodyRef.current = target;
        Animated.spring(bodyHeight, {
          toValue: target,
          damping: 22,
          stiffness: 240,
          mass: 0.85,
          useNativeDriver: false, // height is a layout prop
        }).start();
      },
      [bodyHeight]
    );

    const settleTranslate = useCallback(() => {
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: useNative,
      }).start();
    }, [translateY, useNative]);

    // Non-expandable: simple drag-down-to-dismiss (unchanged behavior).
    const snapBack = useCallback(() => {
      isClosingRef.current = false;
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: useNative,
      }).start();
    }, [translateY, useNative]);

    useImperativeHandle(ref, () => ({ close: closeWithSlide }), [closeWithSlide]);

    const handlePanResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderMove: (_, gs) => {
            if (!expandable) {
              translateY.setValue(Math.max(0, gs.dy));
              return;
            }
            // Up (dy<0) grows the body; down shrinks it. Past the collapsed
            // floor, freeze the body and slide the whole sheet down (dismiss).
            const proposed = restBodyRef.current - gs.dy;
            if (proposed >= collapsedBody) {
              bodyHeight.setValue(Math.min(proposed, expandedBody));
              translateY.setValue(0);
            } else {
              bodyHeight.setValue(collapsedBody);
              translateY.setValue(collapsedBody - proposed);
            }
          },
          onPanResponderRelease: (_, gs) => {
            if (!expandable) {
              if (gs.dy > 96 || gs.vy > 0.9) {
                haptic.light();
                closeWithSlide();
                return;
              }
              snapBack();
              return;
            }
            const proposed = restBodyRef.current - gs.dy;
            // Dragged below the collapsed floor → dismiss zone.
            if (proposed < collapsedBody) {
              if (collapsedBody - proposed > 90 || gs.vy > 0.9) {
                closeWithSlide();
                return;
              }
              snapBody(collapsedBody);
              settleTranslate();
              return;
            }
            // Resize zone: pick expanded vs collapsed by velocity, else nearest.
            if (gs.vy < -0.5) return snapBody(expandedBody);
            if (gs.vy > 0.5) return snapBody(collapsedBody);
            return snapBody(proposed > (collapsedBody + expandedBody) / 2 ? expandedBody : collapsedBody);
          },
          onPanResponderTerminate: () => {
            if (expandable) {
              snapBody(restBodyRef.current);
              settleTranslate();
            } else {
              snapBack();
            }
          },
        }),
      [closeWithSlide, collapsedBody, expandable, expandedBody, bodyHeight, snapBack, snapBody, settleTranslate, translateY]
    );

    const combinedTranslateY = keyboardAvoiding
      ? Animated.add(translateY, keyboardOffset)
      : translateY;

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithSlide}>
        <View style={styles.bottomSheetBackdrop}>
          <Pressable style={styles.bottomSheetOverlay} onPress={closeWithSlide} />
          <Animated.View
            style={[
              styles.modalCard,
              styles.bottomSheetCard,
              { paddingBottom: 14 + insets.bottom, transform: [{ translateY: combinedTranslateY }] },
            ]}
          >
            <View style={styles.bottomSheetDragZone} {...handlePanResponder.panHandlers}>
              <View style={styles.bottomSheetHandle} />
            </View>
            {expandable ? <Animated.View style={{ height: bodyHeight }}>{children}</Animated.View> : children}
          </Animated.View>
        </View>
      </Modal>
    );
  }
);
