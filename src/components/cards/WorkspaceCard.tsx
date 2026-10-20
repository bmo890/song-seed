import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Workspace } from "../../types";
import { Press } from "../common/Press";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { IconButton } from "../common/IconButton";
import { useStore } from "../../state/useStore";
import { colors, spacing } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { UserText } from "../../i18n";

type Props = {
  workspace: Workspace;
  isActive: boolean;
  isPrimary: boolean;
  isEditing: boolean;
  isBusy?: boolean;
  busyLabel?: string;
  onPress: () => void;
  onOpenActions: () => void;
};

function formatLastWorked(ts: number | undefined, t: TFunction): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("workspaceCard.lastWorkedToday");
  if (days === 1) return t("workspaceCard.lastWorkedYesterday");
  if (days < 7) return t("workspaceCard.lastWorkedDays", { count: days });
  if (days < 14) return t("workspaceCard.lastWorkedLastWeek");
  if (days < 30) return t("workspaceCard.lastWorkedWeeks", { count: Math.floor(days / 7) });
  return t("workspaceCard.lastWorkedMonths", { count: Math.floor(days / 30) });
}

/**
 * A workspace in the list (2026-10-20): a row on paper, not a card. Workspaces
 * are structure, so they wear the ListRow shape: the workspace's own mark, its
 * name in Lora, one quiet line of counts and when you last worked in it, its
 * description if it has one, and a bare "…" for its actions. An archived
 * workspace reads the same, in muted ink.
 */
export function WorkspaceCard({
  workspace,
  isPrimary,
  isEditing,
  isBusy = false,
  busyLabel,
  onPress,
  onOpenActions,
}: Props) {
  const { t } = useTranslation();
  const workspaceLastOpenedAt = useStore((s) => s.workspaceLastOpenedAt);
  const lastWorkedLabel = workspace.isArchived ? null : formatLastWorked(workspaceLastOpenedAt[workspace.id], t);
  const topLevelCollectionCount = workspace.collections.filter((c) => !c.parentCollectionId).length;
  const meta = [
    t("common.collectionCount", { count: topLevelCollectionCount }),
    t("common.ideaCount", { count: workspace.ideas.length }),
    lastWorkedLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  const slug = workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return (
    <Press
      // Haptics vocabulary: a row only takes you somewhere; navigation is silent.
      haptic="navigate"
      style={[rowStyles.row, isEditing ? rowStyles.rowEditing : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={workspace.title}
    >
      <View style={workspace.isArchived ? rowStyles.markArchived : null}>
        <WorkspaceAvatar color={workspace.color} name={workspace.title} size={32} avatarKey={workspace.avatarKey} />
      </View>
      <View style={rowStyles.copy}>
        <View style={rowStyles.titleRow}>
          <UserText
            style={[rowStyles.title, workspace.isArchived ? rowStyles.titleArchived : null]}
            numberOfLines={1}
          >
            {workspace.title}
          </UserText>
          {isPrimary ? (
            <View style={rowStyles.primary}>
              <Ionicons name="star" size={10} color={colors.textSecondary} />
              <Text style={rowStyles.primaryLabel}>{t("workspaceCard.primary")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={rowStyles.meta} numberOfLines={1}>
          {isBusy ? busyLabel ?? t("workspaceCard.working") : meta}
        </Text>
        {workspace.description ? (
          <UserText style={rowStyles.description} numberOfLines={2}>
            {workspace.description}
          </UserText>
        ) : null}
      </View>
      {isBusy ? null : (
        <IconButton
          testID={`workspace-actions-${slug}`}
          icon="ellipsis-horizontal"
          tone="muted"
          size={18}
          onPress={onOpenActions}
          accessibilityLabel={t("workspaceCard.options")}
        />
      )}
    </Press>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  rowEditing: {
    opacity: 0.6,
  },
  markArchived: {
    opacity: 0.55,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontFamily: "Lora_500Medium",
    fontSize: 18,
    color: colors.textPrimary,
  },
  titleArchived: {
    color: colors.textSecondary,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  primaryLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  description: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
