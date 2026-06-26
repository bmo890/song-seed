import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { BottomSheet } from "../../common/BottomSheet";
import { StatusChipRow } from "../../common/StatusChipRow";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { IdeaStatus } from "../../../types";

const PROJECT_STATUSES: IdeaStatus[] = ["seed", "sprout", "stem", "song"];

type Props = {
  visible: boolean;
  isDraft: boolean;
  title: string;
  onChangeTitle: (value: string) => void;
  status: IdeaStatus;
  onChangeStatus: (value: IdeaStatus) => void;
  completion: number;
  onChangeCompletion: (value: number) => void;
  onSave: () => void;
  onCancel: () => void;
};

/** Focused editor for a song's metadata — title + progress. Replaces the old
 * full-page edit mode so the rest of the song page stays calm and read-only. */
export function SongEditSheet({
  visible,
  isDraft,
  title,
  onChangeTitle,
  status,
  onChangeStatus,
  completion,
  onChangeCompletion,
  onSave,
  onCancel,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <Text style={styles.heading}>{isDraft ? "New Song" : "Edit Song"}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Song title"
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={[styles.label, styles.labelSpaced]}>Progress</Text>
      <StatusChipRow
        items={PROJECT_STATUSES}
        activeValue={status}
        stretch
        onPress={(next) => {
          onChangeStatus(next);
          if (next === "song") onChangeCompletion(75);
          else if (next === "stem") onChangeCompletion(50);
          else if (next === "sprout") onChangeCompletion(25);
          else onChangeCompletion(0);
        }}
      />
      <Text style={styles.completion}>Completion: {completion}%</Text>
      <Slider
        minimumValue={0}
        maximumValue={100}
        step={5}
        value={completion}
        onValueChange={(value) => {
          onChangeCompletion(value);
          onChangeStatus(value >= 75 ? "song" : value >= 50 ? "stem" : value >= 25 ? "sprout" : "seed");
        }}
        minimumTrackTintColor="#B87D6B"
        maximumTrackTintColor="#D7C2BD"
        thumbTintColor="#B87D6B"
      />

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed ? appStyles.pressDown : null]}
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>{isDraft ? "Discard" : "Cancel"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed ? appStyles.pressDown : null]}
          onPress={onSave}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: { ...textTokens.annotation, marginBottom: spacing.xs },
  labelSpaced: { marginTop: spacing.lg },
  titleInput: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    minHeight: 44,
    textAlignVertical: "top",
  },
  completion: {
    ...textTokens.supporting,
    fontSize: 12,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  cancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
  },
  saveBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  saveText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
});
