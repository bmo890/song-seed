import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { CutUpComposeFlavor } from "../../../domain/cutUp";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

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
  const flavors: Array<{ key: CutUpComposeFlavor; label: string }> = [
    { key: "short", label: t("cutUp.short") },
    { key: "mixed", label: t("cutUp.mixed") },
    { key: "long", label: t("cutUp.long") },
  ];
  const [flavor, setFlavor] = useState<CutUpComposeFlavor>("mixed");

  function confirmRebuild() {
    if (!spark.assembledDraftText.trim()) {
      model.rebuildDraftFromBoard();
      return;
    }
    AppAlert.destructive(
      t("cutUp.rebuildTitle"),
      t("cutUp.rebuildBody"),
      model.rebuildDraftFromBoard,
      { confirmLabel: t("cutUp.rebuild") }
    );
  }

  function compose() {
    haptic.tap();
    model.composeDraft(flavor);
  }

  return (
    <View style={styles.body}>
      {keyboardVisible ? null : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.label}>{t("cutUp.yourDraft")}</Text>
            <Pressable
              style={({ pressed }) => [styles.rebuildBtn, pressed ? appStyles.pressDown : null]}
              onPress={confirmRebuild}
              hitSlop={6}
            >
              <Ionicons name="list-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.rebuildText}>{t("cutUp.boardOrder")}</Text>
            </Pressable>
          </View>

          <View style={styles.composeRow}>
            <View style={styles.flavors}>
              {flavors.map((option) => {
                const active = option.key === flavor;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.flavor, active ? styles.flavorActive : null]}
                    onPress={() => setFlavor(option.key)}
                  >
                    <Text style={[styles.flavorText, active ? styles.flavorTextActive : null]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={({ pressed }) => [styles.composeBtn, pressed ? appStyles.pressDown : null]}
              onPress={compose}
              hitSlop={4}
            >
              <Ionicons name="shuffle" size={15} color={colors.onPrimary} />
              <Text style={styles.composeText}>{t("cutUp.compose")}</Text>
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.card}>
        <UserTextInput
          style={styles.input}
          value={spark.assembledDraftText}
          onChangeText={model.setDraft}
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
  rebuildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  rebuildText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  composeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  flavors: {
    flexDirection: "row",
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    padding: 3,
  },
  flavor: { paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radii.round },
  flavorActive: { backgroundColor: colors.surface },
  flavorText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  flavorTextActive: { color: colors.textPrimary },
  composeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 9,
  },
  composeText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.onPrimary },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
  },
});
