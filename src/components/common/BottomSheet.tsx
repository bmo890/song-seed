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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";

export type BottomSheetRef = { close: () => void };

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  dismissDistance?: number;
  keyboardAvoiding?: boolean;
  children: ReactNode;
};

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet(
    { visible, onClose, dismissDistance = 320, keyboardAvoiding = false, children },
    ref
  ) {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(0)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const isClosingRef = useRef(false);

    useEffect(() => {
      if (!visible) return;
      isClosingRef.current = false;
      translateY.setValue(32);
      keyboardOffset.setValue(0);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    }, [translateY, keyboardOffset, visible]);

    // Keyboard-driven offset: listen to show/hide events and animate
    useEffect(() => {
      if (!keyboardAvoiding || !visible) return;

      const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

      const showSub = Keyboard.addListener(showEvent, (e) => {
        // Shift up by keyboard height; add insets.bottom to compensate for the
        // bottom padding the sheet normally has for the home indicator area
        const offset = -(e.endCoordinates.height);
        Animated.timing(keyboardOffset, {
          toValue: offset,
          duration: Platform.OS === "ios" ? (e.duration ?? 250) : 250,
          useNativeDriver: true,
        }).start();
      });

      const hideSub = Keyboard.addListener(hideEvent, (e) => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: Platform.OS === "ios" ? (e.duration ?? 250) : 250,
          useNativeDriver: true,
        }).start();
      });

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [keyboardAvoiding, visible, keyboardOffset, insets.bottom]);

    const closeWithSlide = useCallback(() => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      Keyboard.dismiss();
      Animated.timing(translateY, {
        toValue: dismissDistance,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          isClosingRef.current = false;
          return;
        }
        onClose();
      });
    }, [dismissDistance, onClose, translateY]);

    const snapBack = useCallback(() => {
      isClosingRef.current = false;
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 240,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    }, [translateY]);

    useImperativeHandle(ref, () => ({ close: closeWithSlide }), [closeWithSlide]);

    const handlePanResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderMove: (_, gs) => {
            translateY.setValue(Math.max(0, gs.dy));
          },
          onPanResponderRelease: (_, gs) => {
            if (gs.dy > 96 || gs.vy > 0.9) {
              closeWithSlide();
              return;
            }
            snapBack();
          },
          onPanResponderTerminate: () => snapBack(),
        }),
      [closeWithSlide, snapBack, translateY]
    );

    // Combine pan gesture translateY with keyboard offset
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
            <View {...handlePanResponder.panHandlers}>
              <View style={styles.bottomSheetDragZone}>
                <View style={styles.bottomSheetHandle} />
              </View>
            </View>
            {children}
          </Animated.View>
        </View>
      </Modal>
    );
  }
);
