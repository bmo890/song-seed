import { StyleProp, StyleSheet, Text, TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { text } from "../../design/tokens";
import { readOnlyLabelKey, type ReadOnlyReason } from "../../hooks/useReadOnly";

/**
 * The one quiet line a read-only place wears where its editing keys would be
 * (decision B, 2026-11-02): "Keep to edit" in a received parcel, "Unarchive to
 * edit" in an archived workspace. A label, not a button — Keep and Unarchive live
 * where they always have. Renders nothing for an editable item.
 */
export function ReadOnlyLine({ reason, style }: { reason: ReadOnlyReason; style?: StyleProp<TextStyle> }) {
  const { t } = useTranslation();
  if (!reason) return null;
  return (
    <Text style={[lineStyles.line, style]} accessibilityRole="text">
      {t(readOnlyLabelKey(reason))}
    </Text>
  );
}

const lineStyles = StyleSheet.create({
  line: {
    ...text.supporting,
  },
});
