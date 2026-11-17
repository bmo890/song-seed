import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { colors, radii, spacing } from "../../design/tokens";

export type HelpItem = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** In place of the icon when the rule is a mark drawn on the page itself (the
   *  metronome pattern's dots): the sheet shows the very mark it explains. */
  mark?: ReactNode;
  /** Optional: a row that needs no heading is just its one line. */
  label?: string;
  description: string;
};

/**
 * The "?" sheet — help law (2026-09-08): it explains INVISIBLE rules only.
 * Visible controls explain themselves through labels, placeholders, disabled
 * states and empty states; a sheet that restates them is noise and gets removed.
 *
 * One grammar: no title (the sheet opens on the page, so the page is the title),
 * a one-line thesis in Lora, then at most four rows whose bodies stay ≤ 12 words.
 * Icons are muted — colour is scarce and a legend is not an action. The list
 * scrolls as a safety net; a sheet that needs it has too many rows.
 */
export function HelpSheet({
  visible,
  onClose,
  thesis,
  lead,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  thesis: string;
  /** Optional: one quiet line under the thesis, the gesture the rows share (when the
   *  thesis says what the tool is for, this says how to work it). */
  lead?: string;
  items: HelpItem[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={[helpStyles.thesis, lead ? helpStyles.thesisWithLead : null]}>{thesis}</Text>
      {lead ? <Text style={helpStyles.lead}>{lead}</Text> : null}
      <ScrollView
        style={helpStyles.scroll}
        contentContainerStyle={helpStyles.list}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <View key={item.label ?? item.description} style={helpStyles.row}>
            <View style={helpStyles.iconWrap}>
              {item.mark ?? (item.icon ? <Ionicons name={item.icon} size={16} color={colors.textSecondary} /> : null)}
            </View>
            <View style={helpStyles.text}>
              {item.label ? <Text style={helpStyles.label}>{item.label}</Text> : null}
              <Text style={helpStyles.desc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const helpStyles = StyleSheet.create({
  thesis: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    lineHeight: 26,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  thesisWithLead: {
    marginBottom: spacing.xs,
  },
  lead: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  scroll: {
    maxHeight: 420,
  },
  list: {
    gap: 14,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  // Tall as the icon and centred, so a one-line row sits level with its glyph.
  text: {
    flex: 1,
    gap: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textPrimary,
  },
  desc: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
