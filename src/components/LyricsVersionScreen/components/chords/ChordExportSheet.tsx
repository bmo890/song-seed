import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../common/BottomSheet";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  onClose: () => void;
  onExportPdf: () => void;
  onExportText: () => void;
  onCopy?: () => void;
  /** Files this chart into a songbook (the Library's book of finished songs). */
  onAddToSongbook?: () => void;
};

export function ChordExportSheet({
  visible,
  onClose,
  onExportPdf,
  onExportText,
  onCopy,
  onAddToSongbook,
}: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>{t("chordEditor.exportTitle")}</Text>

      {onAddToSongbook ? (
        <Option
          icon="book-outline"
          title={t("chordEditor.addSongbook")}
          body={t("chordEditor.addSongbookDesc")}
          onPress={onAddToSongbook}
        />
      ) : null}

      <Option
        icon="document-outline"
        title="PDF"
        body={t("chordEditor.pdfDesc")}
        onPress={onExportPdf}
      />
      <Option
        icon="text-outline"
        title={t("chordEditor.text")}
        body={t("chordEditor.textDesc")}
        onPress={onExportText}
      />
      {onCopy ? (
        <Option
          icon="copy-outline"
          title={t("chordEditor.copyClipboard")}
          body={t("chordEditor.copyClipboardDesc")}
          onPress={onCopy}
        />
      ) : null}
    </BottomSheet>
  );
}

function Option({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [sheetStyles.option, pressed ? appStyles.pressDown : null]}
      onPress={onPress}
    >
      <View style={sheetStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={sheetStyles.copy}>
        <Text style={sheetStyles.optionTitle}>{title}</Text>
        <Text style={sheetStyles.optionBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

const sheetStyles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionTitle: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_700Bold",
  },
  optionBody: {
    ...textTokens.supporting,
    fontSize: 12,
  },
});
