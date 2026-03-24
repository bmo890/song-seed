import React, { useMemo } from "react";
import type { SongIdea } from "../../types";
import { ClipActionsSheet, type ClipActionItem } from "./ClipActionsSheet";

type IdeaActionsSheetProps = {
  visible: boolean;
  idea: SongIdea | null;
  hidden: boolean;
  onEdit: (idea: SongIdea) => void;
  onHide: (idea: SongIdea) => void;
  onUnhide: (idea: SongIdea) => void;
  onShare: (idea: SongIdea) => void;
  onCopy: (idea: SongIdea) => void;
  onMove: (idea: SongIdea) => void;
  onDelete: (idea: SongIdea) => void;
  onCancel: () => void;
};

export function IdeaActionsSheet({
  visible,
  idea,
  hidden,
  onEdit,
  onHide,
  onUnhide,
  onShare,
  onCopy,
  onMove,
  onDelete,
  onCancel,
}: IdeaActionsSheetProps) {
  const actions = useMemo<ClipActionItem[]>(() => {
    if (!idea) return [];
    const dismiss = (fn: (idea: SongIdea) => void) => () => {
      onCancel();
      fn(idea);
    };
    return [
      { key: "edit", label: "Edit", icon: "create-outline" as const, onPress: dismiss(onEdit) },
      hidden
        ? { key: "unhide", label: "Unhide", icon: "eye-outline" as const, onPress: dismiss(onUnhide) }
        : { key: "hide", label: "Hide", icon: "eye-off-outline" as const, onPress: dismiss(onHide) },
      { key: "share", label: "Share", icon: "share-social-outline" as const, onPress: dismiss(onShare) },
      { key: "copy", label: "Copy", icon: "copy-outline" as const, onPress: dismiss(onCopy) },
      { key: "move", label: "Move", icon: "arrow-forward-outline" as const, onPress: dismiss(onMove) },
      { key: "delete", label: "Delete", icon: "trash-outline" as const, destructive: true, onPress: dismiss(onDelete) },
    ];
  }, [idea, hidden, onCancel, onEdit, onHide, onUnhide, onShare, onCopy, onMove, onDelete]);

  return (
    <ClipActionsSheet
      visible={visible}
      title={idea?.title ?? "Actions"}
      subtitle={idea?.kind === "project" ? "Song" : "Clip"}
      actions={actions}
      onCancel={onCancel}
    />
  );
}
