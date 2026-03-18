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
  KeyboardAvoidingView,
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
    const isClosingRef = useRef(false);

    useEffect(() => {
      if (!visible) return;
      isClosingRef.current = false;
      translateY.setValue(32);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    }, [translateY, visible]);

    const closeWithSlide = useCallback(() => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
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

    const contentPanResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_, gs) =>
            gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
          onMoveShouldSetPanResponderCapture: (_, gs) =>
            gs.dy > 14 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2,
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

    const content = (
      <View style={styles.bottomSheetBackdrop}>
        <Pressable style={styles.bottomSheetOverlay} onPress={closeWithSlide} />
        <Animated.View
          {...contentPanResponder.panHandlers}
          style={[
            styles.modalCard,
            styles.bottomSheetCard,
            { paddingBottom: 14 + insets.bottom, transform: [{ translateY }] },
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
    );

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithSlide}>
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {content}
          </KeyboardAvoidingView>
        ) : (
          content
        )}
      </Modal>
    );
  }
);
