import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ShelfItemCard } from "./ShelfItemCard";
import { shelfStyles } from "../styles";
import { colors } from "../../../design/tokens";
import { leavingLabel } from "../../../domain/shelf";
import type { ShelfRow } from "../hooks/useShelfScreenModel";
import { useTranslation } from "react-i18next";

type ShelfDecisionCardProps = {
  row: ShelfRow;
  now: number;
  isActive: boolean;
  isPlaying: boolean;
  onOpen: () => void;
  onTogglePlay: () => void;
  onStopPlay: () => void;
  onSeekStart: () => void;
  onSeek: (ms: number) => void;
  onSeekCancel: () => void;
  onOpenMenu: () => void;
  onViewInCollection: () => void;
  onKeep: () => void;
  onLeave: () => void;
};

/**
 * The blush "Leaving shelf soon" card — an ordinary shelf item wrapped in a
 * quiet, one-time question: keep it 7 more days, or let it leave the shelf.
 * Leaving is scoped to the shelf; the item stays in its collection.
 */
export function ShelfDecisionCard({
  row,
  now,
  isActive,
  isPlaying,
  onOpen,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpenMenu,
  onViewInCollection,
  onKeep,
  onLeave,
}: ShelfDecisionCardProps) {
  const { t } = useTranslation();
  return (
    <View style={shelfStyles.decisionCard}>
      <View style={shelfStyles.decisionEyebrowRow}>
        <Ionicons name="time-outline" size={11} color={colors.primaryDeep} />
        <Text style={shelfStyles.decisionEyebrow}>{leavingLabel(row.entry, now)}</Text>
      </View>

      <ShelfItemCard
        row={row}
        now={now}
        isActive={isActive}
        isPlaying={isPlaying}
        showFooter={false}
        onOpen={onOpen}
        onTogglePlay={onTogglePlay}
        onStopPlay={onStopPlay}
        onSeekStart={onSeekStart}
        onSeek={onSeek}
        onSeekCancel={onSeekCancel}
        onOpenMenu={onOpenMenu}
        onViewInCollection={onViewInCollection}
        containerStyle={shelfStyles.decisionCardBody}
      />

      <View style={shelfStyles.decisionActions}>
        <Pressable
          style={({ pressed }) => [shelfStyles.decisionKeepBtn, pressed ? { opacity: 0.85 } : null]}
          onPress={onKeep}
          accessibilityRole="button"
          accessibilityLabel={t("shelf.keepA11y", { title: row.idea.title })}
        >
          <Text style={shelfStyles.decisionKeepText}>{t("shelf.keepSeven")}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [shelfStyles.decisionLeaveBtn, pressed ? { opacity: 0.7 } : null]}
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={t("shelf.leaveA11y", { title: row.idea.title })}
        >
          <Text style={shelfStyles.decisionLeaveText}>{t("shelf.leave")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
