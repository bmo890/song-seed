import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../common/BottomSheet";
import type { SaveDestination } from "../../domain/collectionManagement";
import { colors } from "../../design/tokens";

type Props = {
  visible: boolean;
  destinations: SaveDestination[];
  selectedCollectionId: string | null;
  onClose: () => void;
  onSelect: (destination: SaveDestination) => void;
};

export function SaveDestinationPickerSheet({
  visible,
  destinations,
  selectedCollectionId,
  onClose,
  onSelect,
}: Props) {
  const groups = useMemo(() => {
    const byWorkspace = new Map<string, { workspaceTitle: string; items: SaveDestination[] }>();
    for (const destination of destinations) {
      const existing = byWorkspace.get(destination.workspaceId);
      if (existing) {
        existing.items.push(destination);
      } else {
        byWorkspace.set(destination.workspaceId, {
          workspaceTitle: destination.workspaceTitle,
          items: [destination],
        });
      }
    }
    return Array.from(byWorkspace.values());
  }, [destinations]);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={localStyles.title}>Choose destination</Text>

      <ScrollView showsVerticalScrollIndicator={false} style={localStyles.scroll}>
        {groups.map((group) => (
          <View key={group.workspaceTitle} style={localStyles.section}>
            <Text style={localStyles.sectionLabel}>{group.workspaceTitle}</Text>
            <View style={localStyles.optionList}>
              {group.items.map((destination) => {
                const isSelected = destination.collectionId === selectedCollectionId;
                return (
                  <Pressable
                    key={destination.collectionId}
                    style={({ pressed }) => [
                      localStyles.option,
                      isSelected ? localStyles.optionSelected : null,
                      pressed ? localStyles.pressed : null,
                    ]}
                    onPress={() => onSelect(destination)}
                  >
                    <Ionicons
                      name="folder"
                      size={18}
                      color={isSelected ? colors.surface : colors.textStrong}
                    />
                    <Text
                      style={[localStyles.optionText, isSelected ? localStyles.optionTextSelected : null]}
                      numberOfLines={1}
                    >
                      {destination.pathLabel ?? destination.label}
                    </Text>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={16} color={colors.surface} />
                    ) : null}
                  </Pressable>
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
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  scroll: {
    maxHeight: 420,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  optionList: {
    gap: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: colors.surfaceContainer,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.surface,
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
});
