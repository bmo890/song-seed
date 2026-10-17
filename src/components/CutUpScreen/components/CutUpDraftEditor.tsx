import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpComposeFlavor } from "../../../domain/cutUp";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

// The writing sheet is a card on the app paper (2026-10-17, paper A).
const PAGE_BG = colors.surface;

// The ways to (re)build a draft from the strips, one clear list behind one
// button — instead of three competing controls fighting for the header.
type RemixOption =
  | { key: "board"; icon: keyof typeof Ionicons.glyphMap }
  | { key: CutUpComposeFlavor; icon: keyof typeof Ionicons.glyphMap };

const REMIX_OPTIONS: RemixOption[] = [
  { key: "board", icon: "list-outline" },
  { key: "short", icon: "remove-outline" },
  { key: "mixed", icon: "shuffle-outline" },
  { key: "long", icon: "reorder-three-outline" },
];

export function CutUpDraftEditor({
  model,
  spark,
  keyboardVisible,
}: {
  model: Model;
  spark: CutUpSpark;
  keyboardVisible: boolean;
}) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  // True once the writer has hand-edited since the last generated draft — so
  // re-rolling a fresh style is friction-free until there's real work to lose.
  const editedRef = useRef(false);

  const runRemix = (option: RemixOption) => {
    editedRef.current = false;
    if (option.key === "board") model.rebuildDraftFromBoard();
    else model.composeDraft(option.key);
  };

  const pickRemix = (option: RemixOption) => {
    const dirty = model.draftField.draft.trim().length > 0 && editedRef.current;
    if (dirty) {
      AppAlert.destructive(t("cutUp.rebuildTitle"), t("cutUp.rebuildBody"), () => runRemix(option), {
        confirmLabel: t("cutUp.rebuild"),
      });
    } else {
      runRemix(option);
    }
  };

  // The ways to rebuild the draft, as the shared menu (glyph, word, one quiet
  // line each) instead of a sheet of tinted icon circles.
  const openRemix = () =>
    AppAlert.menu(
      t("cutUp.remixDraft"),
      REMIX_OPTIONS.map((option) => ({
        key: option.key,
        icon: option.icon,
        label: option.key === "board" ? t("cutUp.boardOrder") : t(`cutUp.${option.key}`),
        hint: option.key === "board" ? t("cutUp.boardOrderDesc") : t(`cutUp.${option.key}Desc`),
        onPress: () => pickRemix(option),
      }))
    );

  const onChangeText = (value: string) => {
    editedRef.current = true;
    model.draftField.onChangeText(value);
  };

  return (
    <View style={styles.body}>
      {keyboardVisible ? null : (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{t("cutUp.yourDraft")}</Text>
          <InkKey
            glyph={<Ionicons name="shuffle" size={16} color={inkKeyColor("idle")} />}
            label={t("cutUp.remixDraft")}
            onPress={openRemix}
            style={styles.headerKey}
          />
        </View>
      )}

      <View style={styles.card}>
        <UserTextInput
          style={[styles.input, { fontSize: size, lineHeight }]}
          value={model.draftField.draft}
          onChangeText={onChangeText}
          onBlur={model.draftField.flush}
          multiline
          textAlignVertical="top"
          placeholder={t("cutUp.draftPlaceholder")}
          placeholderTextColor={colors.textMuted}
        />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: { ...textTokens.annotation },
  headerKey: { minHeight: 36 },
  card: {
    flex: 1,
    backgroundColor: PAGE_BG,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  input: {
    flex: 1,
    fontFamily: "Lora_500Medium",
    color: colors.textStrong,
  },

});
