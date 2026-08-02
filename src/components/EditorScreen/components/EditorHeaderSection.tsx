import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenHeader } from "../../common/ScreenHeader";
import { HelpButton } from "../../common/HelpButton";
import { colors, spacing } from "../../../design/tokens";
import { fmtDuration } from "../../../utils";
import type { ClipVersion } from "../../../types";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

type EditorHeaderSectionProps = {
  sourceClip: ClipVersion | null;
  positionMs: number;
  durationMs: number | null;
  onBack: () => void;
  onHelp: () => void;
};

/** Title, then one meta line: what you're editing on the left, where you are on the
 *  right — the player's own arrangement, so the two rooms read the same. */
export function EditorHeaderSection({
  sourceClip,
  positionMs,
  durationMs,
  onBack,
  onHelp,
}: EditorHeaderSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      <ScreenHeader
        title={t("editor.title")}
        leftIcon="back"
        onLeftPress={onBack}
        rightElement={<HelpButton onPress={onHelp} />}
      />
      <View style={s.metaRow}>
        {sourceClip ? (
          <UserText style={s.clipName} numberOfLines={1}>
            {sourceClip.title}
          </UserText>
        ) : (
          <View style={s.spacer} />
        )}
        {durationMs != null && durationMs > 0 ? (
          <Text style={s.time}>
            {fmtDuration(positionMs)} / {fmtDuration(durationMs)}
          </Text>
        ) : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  spacer: { flex: 1 },
  clipName: {
    flex: 1,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  time: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
