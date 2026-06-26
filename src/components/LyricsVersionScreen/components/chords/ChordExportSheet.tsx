import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../common/BottomSheet";
import { styles as appStyles } from "../../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../../design/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  onExportPdf: () => void;
  onExportText: () => void;
};

export function ChordExportSheet({ visible, onClose, onExportPdf, onExportText }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>Export chords</Text>

      <Option
        icon="document-outline"
        title="PDF"
        body="A print-ready chart — print it, save it, or send a polished copy."
        onPress={onExportPdf}
      />
      <Option
        icon="text-outline"
        title="Text & ChordPro"
        body="Chord-over-lyrics plus ChordPro, to paste into other apps."
        onPress={onExportText}
      />
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
