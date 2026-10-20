import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { useStore } from "../../state/useStore";
import { personalWorkspaces } from "../../domain/workspaceVisibility";
import type { CollectionMoveDestination } from "../../domain/collectionManagement";
import { haptic } from "../../design/haptics";
import { toast } from "./toastStore";
import { AppAlert } from "./AppAlert";
import type { Workspace } from "../../types";

/** The synthetic "as its own workspace" destination. */
const OWN_WORKSPACE = "__own-workspace__";

export type ReceivedPackageMoveResult =
  | { kind: "own-workspace"; workspaceIds: string[] }
  | { kind: "moved"; workspaceId: string; collectionIds: string[]; workspaceTitle: string };

/**
 * Where a received package goes when you keep it — the one chooser for the
 * package page and the Received list's multi-select. Three honest answers:
 * as its own workspace, into a workspace at the top level, or under one of its
 * collections (the collection-move recipe, so it reads like every other move).
 * Several packages at once each land as their own collection at the chosen spot.
 */
export function ReceivedPackageMoveModal({
  packageIds,
  visible,
  onClose,
  onDone,
}: {
  packageIds: string[];
  visible: boolean;
  onClose: () => void;
  onDone: (result: ReceivedPackageMoveResult) => void;
}) {
  const { t } = useTranslation();
  const workspaces = useStore((s) => s.workspaces);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const packages = useMemo(
    () => packageIds.map((id) => workspaces.find((ws) => ws.id === id)).filter((ws): ws is Workspace => !!ws),
    [packageIds, workspaces]
  );

  // A package whose collection carries nested collections can only land at a
  // workspace's top level (sub-collections never nest twice) — so "under a
  // collection" rows are not offered for it, instead of failing on confirm.
  const hasNested = useMemo(
    () => packages.some((pkg) => pkg.collections.some((collection) => !!collection.parentCollectionId)),
    [packages]
  );

  const destinations = useMemo<CollectionMoveDestination[]>(() => {
    const own: CollectionMoveDestination = {
      workspaceId: OWN_WORKSPACE,
      workspaceTitle: t("received.keepTitle"),
      parentCollectionId: null,
      label: packages.length > 1 ? t("received.ownWorkspaces") : t("received.ownWorkspace"),
      subtitle: t("received.ownWorkspaceHint"),
    };
    const targets = personalWorkspaces(workspaces)
      .filter((ws) => !ws.isArchived)
      .flatMap((ws) => {
        const rows: CollectionMoveDestination[] = [
          {
            workspaceId: ws.id,
            workspaceTitle: ws.title,
            parentCollectionId: null,
            label: t("workspaceBrowse.topLevel"),
            subtitle: t("workspaceBrowse.topLevelHint"),
          },
        ];
        if (hasNested) return rows;
        for (const collection of ws.collections.filter((c) => !c.parentCollectionId)) {
          rows.push({
            workspaceId: ws.id,
            workspaceTitle: ws.title,
            parentCollectionId: collection.id,
            label: collection.title,
            subtitle: t("workspaceBrowse.intoCollectionHint"),
          });
        }
        return rows;
      });
    return [own, ...targets];
  }, [hasNested, packages.length, t, workspaces]);

  const reset = () => {
    setSelectedWorkspaceId(null);
    setSelectedParentId(null);
  };

  const confirm = () => {
    if (!selectedWorkspaceId || packages.length === 0) return;
    const state = useStore.getState();
    if (selectedWorkspaceId === OWN_WORKSPACE) {
      for (const pkg of packages) state.adoptReceivedWorkspace(pkg.id);
      haptic.success();
      toast(t("received.adopted"), "checkmark-outline");
      reset();
      onClose();
      onDone({ kind: "own-workspace", workspaceIds: packages.map((pkg) => pkg.id) });
      return;
    }
    const target = workspaces.find((ws) => ws.id === selectedWorkspaceId);
    const collectionIds: string[] = [];
    for (const pkg of packages) {
      const result = state.adoptReceivedPackageInto(pkg.id, selectedWorkspaceId, selectedParentId);
      if (!result.ok) {
        AppAlert.error(t("received.moveFailedTitle"), result.error ?? t("received.moveFailedBody"));
        return;
      }
      collectionIds.push(...result.collectionIds);
    }
    haptic.success();
    toast(t("received.movedTo", { title: target?.title ?? "" }), "checkmark-outline");
    reset();
    onClose();
    onDone({ kind: "moved", workspaceId: selectedWorkspaceId, collectionIds, workspaceTitle: target?.title ?? "" });
  };

  return (
    <CollectionMoveModal
      visible={visible}
      title={
        packages.length > 1
          ? t("received.moveManyTitle", { count: packages.length })
          : t("received.moveOneTitle", { title: packages[0]?.received?.shareTitle ?? packages[0]?.title ?? "" })
      }
      helperText={hasNested ? t("received.moveNestedHint") : t("received.moveHint")}
      confirmLabel={t("received.move")}
      destinations={destinations}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedParentCollectionId={selectedParentId}
      onSelectDestination={(workspaceId, parentCollectionId) => {
        setSelectedWorkspaceId(workspaceId);
        setSelectedParentId(parentCollectionId);
      }}
      onCancel={() => {
        reset();
        onClose();
      }}
      onConfirm={confirm}
    />
  );
}
