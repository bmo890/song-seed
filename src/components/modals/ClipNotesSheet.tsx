import React, { useCallback, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { Button } from "../common/Button";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";

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
  const sheetRef = useRef<BottomSheetRef>(null);

  const handleSave = useCallback(() => {
    onSave();
  }, [onSave]);

  return (
    <BottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onCancel}
      dismissDistance={420}
      keyboardAvoiding
    >
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
            onPress={() => sheetRef.current?.close()}
          />
          <Button
            label="Save"
            style={styles.songDetailMiniCardButton}
            textStyle={styles.songDetailMiniCardButtonText}
            onPress={handleSave}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
