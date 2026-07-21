import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { InlineIdeaCard } from "../../common/InlineIdeaCard";
import { shelfStyles } from "../styles";
import { colors } from "../../../design/tokens";
import { stayCountdownLabel, daysLeft } from "../../../domain/shelf";
import type { ShelfRow } from "../hooks/useShelfScreenModel";
import { useTranslation } from "react-i18next";

type ShelfItemCardProps = {
  row: ShelfRow;
  now: number;
  isActive: boolean;
  isPlaying: boolean;
  /** Hide the source/countdown footer (the decision card carries its own copy). */
  showFooter?: boolean;
  onOpen: () => void;
  onTogglePlay: () => void;
  onStopPlay: () => void;
  onSeekStart: () => void;
  onSeek: (ms: number) => void;
  onSeekCancel: () => void;
  onOpenMenu: () => void;
  onViewInCollection: () => void;
  containerStyle?: React.ComponentProps<typeof InlineIdeaCard>["containerStyle"];
};

export function ShelfItemCard({
  row,
  now,
  isActive,
  isPlaying,
  showFooter = true,
  onOpen,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpenMenu,
  onViewInCollection,
  containerStyle,
}: ShelfItemCardProps) {
  const { t } = useTranslation();
  const soon = daysLeft(row.entry, now) <= 2;

  // Source collection on the left, the quiet countdown + the standardized
  // "view in collection" icon on the right.
  const footerContent = showFooter ? (
    <View style={shelfStyles.itemFooter}>
      <View style={shelfStyles.itemSource}>
        <Ionicons name="folder-outline" size={11} color={colors.textMuted} />
        <Text style={shelfStyles.itemSourceText} numberOfLines={1}>
          {row.sourceLabel}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={[shelfStyles.itemCountdown, soon ? shelfStyles.itemCountdownSoon : null]}
        >
          {stayCountdownLabel(row.entry, now)}
        </Text>
        <Pressable
          style={({ pressed }) => [
            { alignItems: "center", justifyContent: "center" },
            pressed ? { opacity: 0.6 } : null,
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onViewInCollection();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("shelf.viewInCollection", { title: row.idea.title })}
        >
          <Ionicons name="open-outline" size={15} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  ) : undefined;

  return (
    <InlineIdeaCard
      title={row.idea.title}
      isProject={row.idea.kind === "project"}
      status={row.idea.kind === "project" ? row.idea.status : null}
      completionPct={row.idea.kind === "project" ? row.idea.completionPct : null}
      durationMs={row.durationMs}
      canPlay={!!row.playableClip}
      isActive={isActive}
      isPlaying={isPlaying}
      footerContent={footerContent}
      onOpen={onOpen}
      onTogglePlay={onTogglePlay}
      onStopPlay={onStopPlay}
      onSeekStart={onSeekStart}
      onSeek={onSeek}
      onSeekCancel={onSeekCancel}
      onOpenMenu={onOpenMenu}
      containerStyle={containerStyle}
    />
  );
}
