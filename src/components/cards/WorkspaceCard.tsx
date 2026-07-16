import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as globalStyles } from "../../styles";
import { Workspace } from "../../types";
import { SurfaceCard } from "../common/SurfaceCard";
import { WorkspaceAvatar } from "../common/WorkspaceAvatar";
import { IconButton } from "../common/IconButton";
import { useStore } from "../../state/useStore";

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

function formatLastWorked(ts: number | undefined): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Last worked: Today";
  if (days === 1) return "Last worked: Yesterday";
  if (days < 7) return `Last worked: ${days} days ago`;
  if (days < 14) return "Last worked: Last week";
  if (days < 30) return `Last worked: ${Math.floor(days / 7)} weeks ago`;
  return `Last worked: ${Math.floor(days / 30)} months ago`;
}

export function WorkspaceCard({
  workspace,
  isActive,
  isPrimary,
  isEditing,
  isBusy = false,
  busyLabel,
  onPress,
  onOpenActions,
}: Props) {
  const workspaceLastOpenedAt = useStore((s) => s.workspaceLastOpenedAt);
  const lastWorkedLabel = formatLastWorked(workspaceLastOpenedAt[workspace.id]);

  const topLevelCollectionCount = workspace.collections.filter(
    (c) => !c.parentCollectionId
  ).length;
  const seedCount = workspace.ideas.length;

  // ── Archived card ─────────────────────────────────────────────────────────
  if (workspace.isArchived) {
    return (
      <Pressable
        style={({ pressed }) => [
          cardStyles.archivedCard,
          isEditing ? globalStyles.cardEditing : null,
          pressed ? globalStyles.pressDown : null,
        ]}
        onPress={onPress}
      >
        {/* Title row */}
        <View style={cardStyles.archivedTitleRow}>
          <Text style={cardStyles.archivedTitle} numberOfLines={1}>
            {workspace.title}
          </Text>
          {isBusy ? (
            <Text style={[globalStyles.badge, globalStyles.badgeArchived]}>
              {busyLabel ?? "WORKING"}
            </Text>
          ) : (
            <IconButton
              testID={`workspace-actions-${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
              icon="ellipsis-vertical"
              tone="muted"
              size={16}
              onPress={onOpenActions}
              accessibilityLabel="Workspace options"
            />
          )}
        </View>

        {/* Meta row */}
        <View style={cardStyles.archivedMetaRow}>
          <Text style={cardStyles.archivedMeta}>
            {topLevelCollectionCount} {topLevelCollectionCount === 1 ? "Collection" : "Collections"}
          </Text>
          <Text style={cardStyles.archivedMetaDot}>·</Text>
          <Text style={cardStyles.archivedMeta}>
            {seedCount} {seedCount === 1 ? "Seed" : "Seeds"}
          </Text>
        </View>
      </Pressable>
    );
  }

  // ── Active card ────────────────────────────────────────────────────────────
  return (
    <SurfaceCard
      style={[
        cardStyles.cardBase,
        isEditing ? globalStyles.cardEditing : null,
      ]}
      onPress={onPress}
    >
      {/* Avatar row */}
      <View style={cardStyles.avatarRow}>
        <View style={cardStyles.avatarLeft}>
          <WorkspaceAvatar
            color={workspace.color}
            name={workspace.title}
            size={48}
            avatarKey={workspace.avatarKey}
          />
          {isPrimary ? (
            <View style={cardStyles.primaryBadge}>
              <Ionicons name="star" size={10} color="#B87D6B" />
              <Text style={cardStyles.primaryLabel}>Primary</Text>
            </View>
          ) : null}
        </View>
        <View style={cardStyles.avatarRowRight}>
          {isBusy ? (
            <Text style={[globalStyles.badge, globalStyles.badgeArchived]}>
              {busyLabel ?? "WORKING"}
            </Text>
          ) : (
            <IconButton
              testID={`workspace-actions-${workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
              icon="ellipsis-vertical"
              tone="muted"
              size={18}
              onPress={onOpenActions}
              accessibilityLabel="Workspace options"
            />
          )}
        </View>
      </View>

      {/* Name + last worked + description */}
      <View style={cardStyles.nameBlock}>
        <Text style={cardStyles.title} numberOfLines={2}>
          {workspace.title}
        </Text>

        {lastWorkedLabel ? (
          <Text style={cardStyles.lastWorked}>{lastWorkedLabel}</Text>
        ) : null}

        {workspace.description ? (
          <Text style={cardStyles.description} numberOfLines={3}>
            {workspace.description}
          </Text>
        ) : null}
      </View>

      {/* Stats */}
      <View style={cardStyles.statsRow}>
        <View style={cardStyles.statCol}>
          <Text style={cardStyles.statLabel}>Collections</Text>
          <Text style={cardStyles.statValue}>{topLevelCollectionCount}</Text>
        </View>
        <View style={cardStyles.statDivider} />
        <View style={cardStyles.statCol}>
          <Text style={cardStyles.statLabel}>Seeds</Text>
          <Text style={cardStyles.statValue}>{seedCount}</Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

const cardStyles = StyleSheet.create({
  // ── Active card ─────────────────────────────────────────────────────────
  cardBase: {
    borderWidth: 1,
    borderColor: "rgba(215, 194, 189, 0.1)",
    borderRadius: 8,
    padding: 32,
    gap: 0,
    backgroundColor: "#FFFFFF",
    shadowColor: "#3D3732",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  avatarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryBadge: {
    alignItems: "center",
    gap: 2,
  },
  primaryLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 7,
    color: "#B87D6B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  avatarRowRight: {
    alignItems: "flex-end",
  },
  nameBlock: {
    gap: 6,
  },
  title: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 30,
    lineHeight: 36,
    color: "#1C1C19",
  },
  lastWorked: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: "#a89994",
  },
  description: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "#524440",
    lineHeight: 23,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 24,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(215, 194, 189, 0.1)",
  },
  statCol: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(215, 194, 189, 0.15)",
    marginHorizontal: 16,
  },
  statLabel: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    lineHeight: 15,
    color: "#526351",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 18,
    lineHeight: 28,
    color: "#1C1C19",
    fontVariant: ["tabular-nums"],
  },

  // ── Archived card ────────────────────────────────────────────────────────
  archivedCard: {
    backgroundColor: "#F7F3EE",
    opacity: 0.85,
    borderWidth: 1,
    borderColor: "rgba(215, 194, 189, 0.1)",
    borderRadius: 4,
    padding: 24,
    gap: 16,
  },
  archivedTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  archivedTitle: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    lineHeight: 24,
    color: "#1C1C19",
    flex: 1,
  },
  archivedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  archivedMeta: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    lineHeight: 16,
    color: "#526351",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  archivedMetaDot: {
    fontSize: 12,
    color: "#D7C2BD",
  },
});
