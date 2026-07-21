import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  onClose: () => void;
  onNewPage: () => void;
};

export function NewLyricsPadItemSheet({ visible, onClose, onNewPage }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>{t("notepad.newTitle")}</Text>

      <Pressable
        style={({ pressed }) => [sheetStyles.option, pressed ? appStyles.pressDown : null]}
        onPress={onNewPage}
      >
        <View style={sheetStyles.iconWrap}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
        </View>
        <View style={sheetStyles.optionCopy}>
          <Text style={sheetStyles.optionTitle}>{t("notepad.newPage")}</Text>
          <Text style={sheetStyles.optionBody}>{t("notepad.newPageHint")}</Text>
        </View>
      </Pressable>
    </BottomSheet>
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
  optionCopy: {
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
