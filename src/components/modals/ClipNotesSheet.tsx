import React, { useCallback, useRef } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { Button } from "../common/Button";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
      <ScrollView
        style={styles.clipNotesSheetScroll}
        contentContainerStyle={styles.clipNotesSheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TitleInput
          testID="clip-title-input"
          value={titleDraft}
          onChangeText={onChangeTitle}
          placeholder={t("modals.clipTitle")}
          containerStyle={{ marginHorizontal: 0 }}
        />
        {clipSubtitle ? (
          <Text style={styles.clipNotesSheetSubtitle}>{clipSubtitle}</Text>
        ) : null}

        <TextInput
          testID="clip-notes-input"
          style={styles.clipNotesSheetTextInput}
          multiline
          placeholder={t("modals.clipNotes")}
          placeholderTextColor={colors.textMuted}
          value={notesDraft}
          onChangeText={onChangeNotes}
          autoFocus={!notesDraft}
        />

        <View style={styles.clipNotesSheetButtons}>
          <Button
            variant="secondary"
            label={t("common.cancel")}
            style={styles.songDetailMiniCardButton}
            textStyle={styles.songDetailMiniCardButtonText}
            onPress={() => sheetRef.current?.close()}
          />
          <Button
            label={t("common.save")}
            style={styles.songDetailMiniCardButton}
            textStyle={styles.songDetailMiniCardButtonText}
            onPress={handleSave}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
