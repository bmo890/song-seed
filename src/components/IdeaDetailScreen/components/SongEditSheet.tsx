import { StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../common/BottomSheet";
import { Button } from "../../common/Button";
import { StatusChipRow } from "../../common/StatusChipRow";
import { TitleInput } from "../../common/TitleInput";
import { colors, spacing, text as textTokens } from "../../../design/tokens";
import type { IdeaStatus } from "../../../types";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onCancel} keyboardAvoiding>
      <Text style={styles.heading}>{isDraft ? t("songDetail.newSong") : t("songDetail.editSongTitle")}</Text>

      <Text style={styles.label}>{t("songDetail.title")}</Text>
      <TitleInput
        testID="song-title-input"
        value={title}
        onChangeText={onChangeTitle}
        placeholder={t("songDetail.songTitle")}
        showGenerator
        showClear
        multiline
        minHeight={44}
        maxHeight={92}
        containerStyle={styles.titleWrap}
      />

      <Text style={[styles.label, styles.labelSpaced]}>{t("filters.stage")}</Text>
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

      <View style={styles.footer}>
        <Button
          variant="secondary"
          label={isDraft ? t("songDetail.discard") : t("common.cancel")}
          onPress={onCancel}
        />
        <Button
          label={t("common.save")}
          style={styles.saveBtn}
          onPress={onSave}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  label: { ...textTokens.annotation, marginBottom: spacing.xs },
  labelSpaced: { marginTop: spacing.lg },
  titleWrap: { marginHorizontal: 0 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  saveBtn: {
    flex: 1,
  },
});
