import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { CutUpComposeFlavor } from "../../../domain/cutUp";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

const PAGE_BG = "#FBF6EC";

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
  const [menuOpen, setMenuOpen] = useState(false);
  // True once the writer has hand-edited since the last generated draft — so
  // re-rolling a fresh style is friction-free until there's real work to lose.
  const editedRef = useRef(false);

  const runRemix = (option: RemixOption) => {
    haptic.tap();
    editedRef.current = false;
    if (option.key === "board") model.rebuildDraftFromBoard();
    else model.composeDraft(option.key);
  };

  const pickRemix = (option: RemixOption) => {
    setMenuOpen(false);
    const dirty = spark.assembledDraftText.trim().length > 0 && editedRef.current;
    if (dirty) {
      AppAlert.destructive(t("cutUp.rebuildTitle"), t("cutUp.rebuildBody"), () => runRemix(option), {
        confirmLabel: t("cutUp.rebuild"),
      });
    } else {
      runRemix(option);
    }
  };

  const onChangeText = (value: string) => {
    editedRef.current = true;
    model.setDraft(value);
  };

  return (
    <View style={styles.body}>
      {keyboardVisible ? null : (
        <View style={styles.headerRow}>
          <Text style={styles.label}>{t("cutUp.yourDraft")}</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [styles.remixBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => {
                haptic.tap();
                setMenuOpen(true);
              }}
              hitSlop={6}
            >
              <Ionicons name="shuffle" size={14} color={colors.primaryDeep} />
              <Text style={styles.remixText}>{t("cutUp.remixDraft")}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <UserTextInput
          style={[styles.input, { fontSize: size, lineHeight }]}
          value={spark.assembledDraftText}
          onChangeText={onChangeText}
          multiline
          textAlignVertical="top"
          placeholder={t("cutUp.draftPlaceholder")}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Text style={styles.sheetTitle}>{t("cutUp.remixDraft")}</Text>
        <Text style={styles.sheetSubtitle}>{t("cutUp.remixSubtitle")}</Text>
        <View style={styles.optionList}>
          {REMIX_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={({ pressed }) => [styles.optionRow, pressed ? appStyles.pressDown : null]}
              onPress={() => pickRemix(option)}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon} size={18} color={colors.primaryDeep} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>
                  {option.key === "board" ? t("cutUp.boardOrder") : t(`cutUp.${option.key}`)}
                </Text>
                <Text style={styles.optionDesc}>{t(`cutUp.${option.key}Desc`)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  remixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  remixText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12, color: colors.primaryDeep },
  card: {
    flex: 1,
    backgroundColor: PAGE_BG,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  input: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    color: colors.textStrong,
  },

  sheetTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 19, color: colors.textPrimary, marginBottom: 4 },
  sheetSubtitle: { ...textTokens.supporting, marginBottom: spacing.md },
  optionList: { gap: 2 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: { flex: 1, minWidth: 0, gap: 1 },
  optionLabel: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 15, color: colors.textPrimary },
  optionDesc: { ...textTokens.supporting, fontSize: 12.5 },
});
