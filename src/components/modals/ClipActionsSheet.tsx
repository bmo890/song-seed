import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";

type ClipActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type ClipActionsSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: ClipActionItem[];
  onCancel: () => void;
};

function SheetActionRow({ label, icon, destructive = false, onPress }: ClipActionItem) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.collectionActionsOption,
        styles.clipActionsOption,
        destructive ? styles.collectionActionsOptionDestructive : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.collectionActionsOptionLead}>
        <Ionicons name={icon} size={16} color={destructive ? "#b91c1c" : "#334155"} />
        <Text
          style={[
            styles.collectionActionsOptionText,
            destructive ? styles.collectionActionsOptionTextDestructive : null,
          ]}
        >
          {label}
        </Text>
      </View>
      <Ionicons
        name={destructive ? "alert-circle-outline" : "chevron-forward"}
        size={15}
        color={destructive ? "#b91c1c" : "#94a3b8"}
      />
    </Pressable>
  );
}

export function ClipActionsSheet({
  visible,
  title,
  subtitle,
  actions,
  onCancel,
}: ClipActionsSheetProps) {
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
      toValue: 320,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        isClosingRef.current = false;
        return;
      }
      onCancel();
    });
  }, [onCancel, translateY]);

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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 96 || gestureState.vy > 0.9) {
            closeWithSlide();
            return;
          }
          snapBack();
        },
        onPanResponderTerminate: () => {
          snapBack();
        },
      }),
    [closeWithSlide, snapBack, translateY]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithSlide}>
      <View style={styles.bottomSheetBackdrop}>
        <Pressable style={styles.bottomSheetOverlay} onPress={closeWithSlide} />
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.modalCard,
            styles.bottomSheetCard,
            { paddingBottom: 14 + insets.bottom, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.bottomSheetDragZone}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.clipActionsTitleBlock}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.clipActionsSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          <View style={[styles.collectionActionsOptionList, styles.clipActionsOptionList]}>
            {actions.map(({ key, ...action }) => (
              <SheetActionRow key={key} {...action} />
            ))}
            <Pressable
              style={({ pressed }) => [
                styles.collectionActionsOption,
                styles.clipActionsOption,
                pressed ? styles.pressDown : null,
              ]}
              onPress={closeWithSlide}
            >
              <View style={styles.collectionActionsOptionLead}>
                <Ionicons name="close-outline" size={16} color="#334155" />
                <Text style={styles.collectionActionsOptionText}>Cancel</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
