import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Press } from "./Press";
import { AppAlert } from "./AppAlert";
import { toast } from "./toastStore";
import { ReceivedPackageMoveModal, type ReceivedPackageMoveResult } from "./ReceivedPackageMoveModal";
import { UserText, useLocale } from "../../i18n";
import { useStore } from "../../state/useStore";
import { useReceivedParcelStore } from "../../state/useReceivedParcelStore";
import {
  defaultKeepPlan,
  keepLabelKey,
  parcelRows,
  PARCEL_ROWS_MAX,
  type ParcelRow,
} from "../../domain/receivedParcel";
import { getHierarchyIconName } from "../../domain/hierarchy";
import { getRootNavigation, openCollectionAsBrowseRoot, openWorkspaceBrowseRoot, visitCollection } from "../../navigation";
import { haptic } from "../../design/haptics";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import type { ShareKind, Workspace } from "../../types";

const SHEET_EXIT_MS = 260;

const KIND_ICONS: Record<ShareKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  setlist: "albums-outline",
  playlist: "musical-notes-outline",
  songbook: "book-outline",
  sketch: getHierarchyIconName("song"),
  collection: "folder-outline",
  workspace: "file-tray-stacked-outline",
  clips: "musical-notes-outline",
  library: "library-outline",
};

const ROW_ICONS: Record<ParcelRow["icon"], React.ComponentProps<typeof Ionicons>["name"]> = {
  folder: "folder-outline",
  sketch: getHierarchyIconName("song"),
  clip: "musical-notes-outline",
};

/** Root-mounted: the one parcel sheet, for whichever package was asked for. */
export function ReceivedParcelHost() {
  const packageId = useReceivedParcelStore((s) => s.packageId);
  const seq = useReceivedParcelStore((s) => s.seq);
  const pkg = useStore((s) => (packageId ? s.workspaces.find((ws) => ws.id === packageId) : undefined));
  if (!pkg || pkg.origin !== "received") return null;
  return <ReceivedParcelSheet key={seq} pkg={pkg} />;
}

/**
 * A received parcel's front door: what it is, who sent it, exactly what is
 * inside, and one key that keeps it. Keep MOVES the package into your
 * workspaces (one copy of the audio; Received no longer lists it) and lands
 * you on the thing you kept. "Look first" opens it in Received as it is;
 * "Somewhere else…" opens the full chooser.
 */
function ReceivedParcelSheet({ pkg }: { pkg: Workspace }) {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
  const close = useReceivedParcelStore((s) => s.close);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const markReceivedPackageOpened = useStore((s) => s.markReceivedPackageOpened);
  const updateCollection = useStore((s) => s.updateCollection);
  const [visible, setVisible] = useState(true);
  const [chooserOpen, setChooserOpen] = useState(false);

  const kind: ShareKind = pkg.received?.shareKind ?? "library";
  const title = pkg.received?.shareTitle ?? pkg.title;

  // A loose-files parcel arrives as one collection named "Files". Whatever
  // road it takes from here (keep, chooser, look), it should wear the
  // parcel's name, so the rename happens once, at the door.
  useEffect(() => {
    const only = pkg.collections.length === 1 ? pkg.collections[0] : undefined;
    if (only && only.title === "Files" && title) updateCollection(pkg.id, only.id, { title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.id]);
  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null;
  const plan = useMemo(() => defaultKeepPlan(pkg, activeWorkspace), [pkg, activeWorkspace]);
  const rows = useMemo(
    () =>
      parcelRows(pkg, {
        takes: (count) => t("received.takes", { count }),
        items: (count) => t("received.items", { count }),
        lyrics: t("common.lyrics"),
        chart: t("screens.chart"),
      }),
    [pkg, t]
  );
  const shownRows = rows.slice(0, PARCEL_ROWS_MAX);
  const moreRows = rows.length - shownRows.length;

  const meta = [
    pkg.received?.senderName ? t("received.from", { name: pkg.received.senderName }) : t("received.fromSomeone"),
    pkg.received?.receivedAt
      ? new Date(pkg.received.receivedAt).toLocaleDateString(formatLocale, { month: "short", day: "numeric" })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const destination =
    plan.mode === "own-workspace"
      ? t("received.keepsAsWorkspace")
      : t("received.keepsInto", { title: activeWorkspace?.title ?? "" });

  // The sheet owns its exit: BottomSheet animates out, then the store clears.
  const fold = (after?: () => void) => {
    setVisible(false);
    setTimeout(() => {
      close();
      after?.();
    }, SHEET_EXIT_MS);
  };

  const nav = () => getRootNavigation(null);

  const landAfterKeep = (result: ReceivedPackageMoveResult) => {
    const state = useStore.getState();
    if (result.kind === "own-workspace") {
      const workspaceId = result.workspaceIds[0];
      if (!workspaceId) return;
      state.setActiveWorkspaceId(workspaceId);
      openWorkspaceBrowseRoot(nav(), workspaceId);
      return;
    }
    state.setActiveWorkspaceId(result.workspaceId);
    const collectionId = result.collectionIds[0];
    if (collectionId) {
      openCollectionAsBrowseRoot(nav(), { collectionId, workspaceId: result.workspaceId });
    } else {
      openWorkspaceBrowseRoot(nav(), result.workspaceId);
    }
  };

  const keep = () => {
    const state = useStore.getState();
    if (plan.mode === "own-workspace") {
      state.adoptReceivedWorkspace(pkg.id);
      // Haptics: `success` — a meaningful completion; the parcel is yours.
      haptic.success();
      toast(t("received.kept"), "checkmark-outline");
      fold(() => landAfterKeep({ kind: "own-workspace", workspaceIds: [pkg.id] }));
      return;
    }
    const result = state.adoptReceivedPackageInto(pkg.id, plan.workspaceId, null);
    if (!result.ok) {
      AppAlert.error(t("received.moveFailedTitle"), result.error ?? t("received.moveFailedBody"));
      return;
    }
    haptic.success();
    toast(t("received.kept"), "checkmark-outline");
    const workspaceId = plan.workspaceId;
    fold(() =>
      landAfterKeep({
        kind: "moved",
        workspaceId,
        collectionIds: result.collectionIds,
        workspaceTitle: activeWorkspace?.title ?? "",
      })
    );
  };

  const lookFirst = () => {
    const collection = pkg.collections.find((c) => !c.parentCollectionId) ?? pkg.collections[0];
    if (!collection) return;
    markReceivedPackageOpened(pkg.id);
    fold(() => visitCollection(nav(), { collectionId: collection.id, workspaceId: pkg.id }));
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={() => fold()} dismissDistance={420}>
        <View style={local.content}>
          <View style={local.header}>
            <Ionicons name="mail-open-outline" size={15} color={colors.primaryDeep} />
            <Text style={local.eyebrow}>{t("received.parcelEyebrow", { kind: t(`received.${kind}`) })}</Text>
          </View>
          <View style={local.titleRow}>
            <View style={local.kindBadge}>
              <Ionicons name={KIND_ICONS[kind]} size={18} color={colors.primaryDeep} />
            </View>
            <View style={local.titleCopy}>
              <UserText value={title} style={local.title} numberOfLines={2}>
                {title}
              </UserText>
              <Text style={local.meta} numberOfLines={1}>
                {meta}
              </Text>
            </View>
          </View>

          <View style={local.rows}>
            {shownRows.map((row) => (
              <View key={row.key} style={local.row}>
                <Ionicons name={ROW_ICONS[row.icon]} size={15} color={colors.textSecondary} />
                <UserText value={row.title} style={local.rowTitle} numberOfLines={1}>
                  {row.title}
                </UserText>
                <Text style={local.rowMeta} numberOfLines={1}>
                  {row.meta}
                </Text>
              </View>
            ))}
            {moreRows > 0 ? <Text style={local.more}>{t("received.moreRows", { count: moreRows })}</Text> : null}
          </View>

          <Text style={local.hint}>{destination}</Text>
          <Button testID="parcel-keep" label={t(keepLabelKey(kind))} onPress={keep} hapticFeedback={false} />
          <View style={local.links}>
            <Press
              feel="glyph"
              onPress={lookFirst}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("received.lookFirst")}
              testID="parcel-look"
            >
              <Text style={local.link}>{t("received.lookFirst")}</Text>
            </Press>
            <Press
              feel="glyph"
              onPress={() => setChooserOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("received.somewhereElse")}
              testID="parcel-elsewhere"
            >
              <Text style={local.link}>{t("received.somewhereElse")}</Text>
            </Press>
          </View>
        </View>
        {/* Hosted inside the sheet: iOS won't present a second Modal beside a visible
            one, and the chooser never appeared (overnight check 2026-10-20). */}
        <ReceivedPackageMoveModal
          packageIds={[pkg.id]}
          visible={chooserOpen}
          onClose={() => setChooserOpen(false)}
          onDone={(result) => fold(() => landAfterKeep(result))}
        />
      </BottomSheet>
    </>
  );
}

const local = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primaryDeep,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  kindBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primarySurface,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 19,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  meta: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  rows: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.lg,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 36,
  },
  rowTitle: {
    ...textTokens.body,
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    ...textTokens.caption,
    color: colors.textMuted,
    flexShrink: 0,
    fontVariant: ["tabular-nums"],
  },
  more: {
    ...textTokens.caption,
    color: colors.textMuted,
    paddingVertical: 6,
  },
  hint: {
    ...textTokens.supporting,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  link: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
    paddingVertical: 6,
  },
});
