import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { Button } from "../common/Button";

type ClipNotesSheetProps = {
  visible: boolean;
  clipSubtitle: string;
  titleDraft: string;
  notesDraft: string;
  onChangeTitle: (text: string) => void;
  onChangeNotes: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ClipNotesSheet({
  visible,
  clipSubtitle,
  titleDraft,
  notesDraft,
  onChangeTitle,
  onChangeNotes,
  onSave,
  onCancel,
}: ClipNotesSheetProps) {
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
      toValue: 420,
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

  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithSlide}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            </View>

            <View style={styles.clipNotesSheetContent}>
              <TitleInput
                value={titleDraft}
                onChangeText={onChangeTitle}
                placeholder="Clip title"
                containerStyle={{ marginHorizontal: 0 }}
              />
              {clipSubtitle ? (
                <Text style={styles.clipNotesSheetSubtitle}>{clipSubtitle}</Text>
              ) : null}

              <TextInput
                style={styles.clipNotesSheetTextInput}
                multiline
                placeholder="Add notes about this clip..."
                placeholderTextColor="#94a3b8"
                value={notesDraft}
                onChangeText={onChangeNotes}
                autoFocus={!notesDraft}
              />

              <View style={styles.clipNotesSheetButtons}>
                <Button
                  variant="secondary"
                  label="Cancel"
                  style={styles.songDetailMiniCardButton}
                  textStyle={styles.songDetailMiniCardButtonText}
                  onPress={closeWithSlide}
                />
                <Button
                  label="Save"
                  style={styles.songDetailMiniCardButton}
                  textStyle={styles.songDetailMiniCardButtonText}
                  onPress={handleSave}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
