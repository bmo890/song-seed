import React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { IdeaCard } from "./IdeaCard";
import { ClipInlinePlayer } from "./ClipInlinePlayer";
import { IconButton } from "./IconButton";
import { StatusBadge } from "./StatusBadge";
import { styles } from "../../styles";
import type { IdeaStatus } from "../../types";
import { fmtDuration } from "../../utils";
import { colors } from "../../design/tokens";

export type InlineIdeaCardProps = {
  title: string;
  /** Projects get the semibold title + terracotta accent bar; clips don't. */
  isProject: boolean;
  /** Stage badge (projects only); pass null to hide it (e.g. clips). */
  status: IdeaStatus | null;
  /** Completion % shown in the badge for projects. */
  completionPct?: number | null;
  durationMs: number;
  canPlay: boolean;
  /** This card is the active inline-player target. */
  isActive: boolean;
  isPlaying: boolean;
  /** Single muted footer line — a Revisit reason, an Activity action, etc. */
  footer?: string;
  /** Custom footer row; takes precedence over `footer` (e.g. an action label
   * plus an inline "view in collection" link). */
  footerContent?: React.ReactNode;
  onOpen: () => void;
  onTogglePlay: () => void;
  onStopPlay: () => void;
  onSeekStart: () => void;
  onSeek: (ms: number) => void;
  onSeekCancel: () => void;
  /** When provided, renders the trailing ⋯ button and wires long-press to it. */
  onOpenMenu?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * The canonical inline "idea row" card — a thin, opinionated wrapper over
 * IdeaCard shared by Revisit and Activity so both read exactly like the
 * collection card: lead play + duration, stage badge with %, a quiet ⋯ menu,
 * a tap-to-stop accessory, and an inline scrubber while playing. Callers only
 * supply normalized data + handlers and the single footer line.
 */
export function InlineIdeaCard({
  title,
  isProject,
  status,
  completionPct,
  durationMs,
  canPlay,
  isActive,
  isPlaying,
  footer,
  footerContent,
  onOpen,
  onTogglePlay,
  onStopPlay,
  onSeekStart,
  onSeek,
  onSeekCancel,
  onOpenMenu,
  containerStyle,
}: InlineIdeaCardProps) {
  const durationLabel = durationMs > 0 ? fmtDuration(durationMs) : "--:--";
  const pct =
    status != null && completionPct != null
      ? Math.max(0, Math.min(100, Math.round(completionPct)))
      : undefined;

  const trailing =
    status || onOpenMenu ? (
      <View style={inlineStyles.trailing}>
        {status ? (
          <StatusBadge status={status} pct={pct} style={styles.ideasListStatusBadgeText} />
        ) : null}
        {onOpenMenu ? (
          <IconButton
            icon="ellipsis-horizontal"
            tone="muted"
            size={18}
            onPress={onOpenMenu}
            stopPropagation
            accessibilityLabel="More options"
          />
        ) : null}
      </View>
    ) : undefined;

  return (
    <IdeaCard
      accentBorderColor={isProject ? colors.primary : null}
      canPlay={canPlay}
      isInlinePlaying={isPlaying}
      inlineActive={isActive}
      durationLabel={durationLabel}
      onPressLead={onTogglePlay}
      onPress={onOpen}
      onLongPress={onOpenMenu ?? onOpen}
      title={title}
      titleSemiBold={isProject}
      trailing={trailing}
      footerDate={footer}
      footerContent={footerContent}
      containerStyle={containerStyle}
      inlinePlayerContent={
        <ClipInlinePlayer
          fallbackDurationMs={durationMs}
          onSeek={onSeek}
          onSeekStart={onSeekStart}
          onSeekCancel={onSeekCancel}
          onClose={onStopPlay}
        />
      }
    />
  );
}

const inlineStyles = {
  trailing: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
};
