import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Press } from "../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../common/BottomSheet";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import type { SaveDestination } from "../../domain/collectionManagement";
import { colors, text } from "../../design/tokens";
import { formatLastEdited } from "../../utils";
import { UserText } from "../../i18n";
import { useTranslation } from "react-i18next";

type Props = {
  visible: boolean;
  destinations: SaveDestination[];
  selectedCollectionId: string | null;
  /** The collection the recording was started from — marked so you can find your way back. */
  originCollectionId?: string | null;
  onClose: () => void;
  onSelect: (destination: SaveDestination) => void;
};

/** Indent per nesting level. The tree reads through indentation, not "A / B" paths. */
const INDENT_STEP = 18;

type Group = {
  workspaceId: string;
  workspaceTitle: string;
  workspaceColor?: string;
  workspaceAvatarKey?: number;
  items: SaveDestination[];
};

/**
 * Where a fresh clip lands. Each workspace wears its avatar (the same mark as the
 * side menu) and each collection the structural-row recipe from the workspace hub:
 * rows on paper (2026-10-18), a bare ink folder, the name, and a quiet
 * count · last-worked line, so two "Demos" in two workspaces never look alike.
 * The chosen one carries the tick; nothing else is coloured.
 */
export function SaveDestinationPickerSheet({
  visible,
  destinations,
  selectedCollectionId,
  originCollectionId = null,
  onClose,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const byWorkspace = new Map<string, Group>();
    for (const destination of destinations) {
      const existing = byWorkspace.get(destination.workspaceId);
      if (existing) {
        existing.items.push(destination);
      } else {
        byWorkspace.set(destination.workspaceId, {
          workspaceId: destination.workspaceId,
          workspaceTitle: destination.workspaceTitle,
          workspaceColor: destination.workspaceColor,
          workspaceAvatarKey: destination.workspaceAvatarKey,
          items: [destination],
        });
      }
    }
    return Array.from(byWorkspace.values());
  }, [destinations]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={localStyles.title}>{t("modals.chooseDestination")}</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={localStyles.scroll}>
        {groups.map((group) => (
          <View key={group.workspaceId} style={localStyles.section}>
            <View style={localStyles.workspaceRow}>
              <WorkspaceAvatar
                color={group.workspaceColor}
                name={group.workspaceTitle}
                avatarKey={group.workspaceAvatarKey}
                size={20}
              />
              <UserText style={localStyles.workspaceTitle} numberOfLines={1}>
                {group.workspaceTitle}
              </UserText>
            </View>

            <View style={localStyles.surface}>
              {group.items.map((destination, index) => {
                const isSelected = destination.collectionId === selectedCollectionId;
                const isOrigin = destination.collectionId === originCollectionId;
                const meta = [
                  t("brand.ideaCount", { count: destination.itemCount }),
                  destination.lastWorkedAt > 0 ? formatLastEdited(destination.lastWorkedAt) : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ");
                return (
                  <Press
                    // haptics.ts: light → a small state flip (a choice in a set).
                    haptic="light"
                    key={destination.collectionId}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${destination.pathLabel ?? destination.label}, ${meta}`}
                    style={[localStyles.row,
                      { paddingStart: 2 + destination.depth * INDENT_STEP },
                      index > 0 ? localStyles.rowDivided : null]}
                    onPress={() => onSelect(destination)}
                  >
                    <Ionicons
                      name={isSelected ? "folder-open-outline" : "folder-outline"}
                      size={destination.depth > 0 ? 17 : 19}
                      color={colors.textStrong}
                    />
                    <View style={localStyles.copy}>
                      <View style={localStyles.titleRow}>
                        <UserText
                          style={[
                            localStyles.optionText,
                            isSelected ? localStyles.optionTextSelected : null,
                          ]}
                          numberOfLines={1}
                        >
                          {destination.label}
                        </UserText>
                        {isOrigin ? (
                          <Text style={localStyles.originLabel} numberOfLines={1}>
                            {t("modals.startedHere")}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={localStyles.meta} numberOfLines={1}>
                        {meta}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={colors.primaryDeep} accessibilityElementsHidden />
                    ) : null}
                  </Press>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const localStyles = StyleSheet.create({
  title: {
    ...text.headerTitle,
    fontSize: 19,
    marginBottom: 14,
  },
  scroll: {
    maxHeight: 460,
  },
  section: {
    marginBottom: 18,
  },
  workspaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 8,
  },
  workspaceTitle: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.textStrong,
  },
  // Structure is rows on paper: hairlines above and below, no panel.
  surface: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingEnd: 4,
    paddingVertical: 10,
    minHeight: 54,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionText: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    fontFamily: "PlusJakartaSans_700Bold",
  },
  originLabel: {
    flexShrink: 0,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
});
