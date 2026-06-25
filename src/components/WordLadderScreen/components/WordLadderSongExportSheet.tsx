import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";

export type WordLadderSongOption = {
  workspaceTitle: string;
  songId: string;
  songTitle: string;
};

type Props = {
  visible: boolean;
  songOptions: WordLadderSongOption[];
  onClose: () => void;
  onSelect: (songId: string) => void;
};

export function WordLadderSongExportSheet({ visible, songOptions, onClose, onSelect }: Props) {
  const groups = useMemo(() => {
    const byWorkspace = new Map<string, WordLadderSongOption[]>();
    for (const option of songOptions) {
      const list = byWorkspace.get(option.workspaceTitle) ?? [];
      list.push(option);
      byWorkspace.set(option.workspaceTitle, list);
    }
    return Array.from(byWorkspace.entries());
  }, [songOptions]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={sheetStyles.title}>Send lines to a song</Text>
      <Text style={sheetStyles.subtitle}>
        Starred lines go first — if nothing's starred, every line ships as a new lyrics version.
      </Text>

      {groups.length === 0 ? (
        <View style={sheetStyles.emptyState}>
          <Ionicons name="musical-notes-outline" size={24} color={colors.textMuted} />
          <Text style={sheetStyles.emptyText}>No songs yet — start one in a workspace first.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.scroll}>
          {groups.map(([workspaceTitle, options]) => (
            <View key={workspaceTitle} style={sheetStyles.group}>
              <Text style={sheetStyles.groupLabel}>{workspaceTitle}</Text>
              {options.map((option) => (
                <Pressable
                  key={option.songId}
                  style={({ pressed }) => [sheetStyles.option, pressed ? appStyles.pressDown : null]}
                  onPress={() => onSelect(option.songId)}
                >
                  <Ionicons name="musical-note-outline" size={16} color={colors.textSecondary} />
                  <Text style={sheetStyles.optionTitle} numberOfLines={1}>
                    {option.songTitle}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...textTokens.supporting,
    marginBottom: spacing.md,
  },
  scroll: {
    maxHeight: 420,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupLabel: {
    ...textTokens.sectionTitle,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.xs,
  },
  optionTitle: {
    ...textTokens.body,
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...textTokens.supporting,
    textAlign: "center",
  },
});
